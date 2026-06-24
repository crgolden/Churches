#pragma warning disable SA1200
using System.Diagnostics;
using System.Security.Claims;
using Azure.Identity;
using Azure.Monitor.OpenTelemetry.AspNetCore;
using Azure.Security.KeyVault.Secrets;
using Churches.Server.Extensions;
using Duende.Bff;
using Duende.Bff.AccessTokenManagement;
using Duende.Bff.DynamicFrontends;
using Duende.Bff.Yarp;
using Duende.IdentityModel;
using Elastic.Ingest.Elasticsearch;
using Elastic.Ingest.Elasticsearch.DataStreams;
using Elastic.Serilog.Sinks;
using Elastic.Transport;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Azure;
using OpenTelemetry.Instrumentation.AspNetCore;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;
#pragma warning restore SA1200

Log.Logger = new LoggerConfiguration().WriteTo.Console().CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);
    var openIdConnectOptionsSection = builder.Configuration.GetRequiredSection(nameof(OpenIdConnectOptions));
    var openIdConnectOptions = openIdConnectOptionsSection.Get<OpenIdConnectOptions>() ?? throw new InvalidOperationException($"Invalid '{nameof(OpenIdConnectOptions)}' section.");
    Uri oidcAuthority = builder.Configuration.GetRequired<Uri>("OidcAuthority"),
        directoryApiAddress = builder.Configuration.GetRequired<Uri>("DirectoryApiAddress");
    string churchesClientId, churchesClientSecret;
    if (builder.Environment.IsProduction())
    {
        var defaultAzureCredentialOptionsSection = builder.Configuration.GetRequiredSection(nameof(DefaultAzureCredentialOptions));
        var defaultAzureCredentialOptions = defaultAzureCredentialOptionsSection.Get<DefaultAzureCredentialOptions>() ?? throw new InvalidOperationException($"Invalid '{nameof(DefaultAzureCredentialOptions)}' section.");
        var tokenCredential = new DefaultAzureCredential(defaultAzureCredentialOptions);
        Uri blobUri = builder.Configuration.GetRequired<Uri>("BlobUri"),
            dataProtectionKeyIdentifier = builder.Configuration.GetRequired<Uri>("DataProtectionKeyIdentifier"),
            elasticsearchNode = builder.Configuration.GetRequired<Uri>("ElasticsearchNode"),
            keyVaultUrl = builder.Configuration.GetRequired<Uri>("KeyVaultUri");
        var applicationName = builder.Configuration.GetRequired<string>("WEBSITE_SITE_NAME");
        var secretClient = new SecretClient(keyVaultUrl, tokenCredential);
        var secrets = secretClient.GetChurchesSecrets();
        churchesClientId = secrets.ChurchesClientId.Value;
        churchesClientSecret = secrets.ChurchesClientSecret.Value;
        builder.Services.Configure<AspNetCoreTraceInstrumentationOptions>(options => options.Filter = context => !context.Request.Path.StartsWithSegments("/health", StringComparison.OrdinalIgnoreCase));
        builder.Logging.AddOpenTelemetry(openTelemetryLoggerOptions =>
        {
            openTelemetryLoggerOptions.IncludeFormattedMessage = true;
            openTelemetryLoggerOptions.IncludeScopes = true;
        });
        builder.Services
            .AddSerilog((serviceProvider, loggerConfiguration) => loggerConfiguration
                .ReadFrom.Configuration(builder.Configuration)
                .ReadFrom.Services(serviceProvider)
                .Enrich.WithProperty(nameof(IHostEnvironment.ApplicationName), applicationName)
                .WriteTo.Elasticsearch(
                    [elasticsearchNode],
                    elasticsearchSinkOptions =>
                    {
                        elasticsearchSinkOptions.DataStream = new DataStreamName("logs", "dotnet", nameof(Churches));
                        elasticsearchSinkOptions.BootstrapMethod = BootstrapMethod.Failure;
                        elasticsearchSinkOptions.TextFormatting.MapCustom = (ecsDocument, _) =>
                        {
                            ecsDocument.Service ??= new Elastic.CommonSchema.Service();
                            ecsDocument.Service.Name = applicationName;
                            return ecsDocument;
                        };
                    },
                    transportConfiguration =>
                    {
                        var header = new BasicAuthentication(secrets.ElasticsearchUsername.Value, secrets.ElasticsearchPassword.Value);
                        transportConfiguration.Authentication(header);
                    }))
            .AddOpenTelemetry()
            .ConfigureResource(resourceBuilder => resourceBuilder
                .AddService(applicationName, null, typeof(Program).Assembly.GetName().Version?.ToString() ?? "0.0.0")
                .AddAttributes(new Dictionary<string, object>
                {
                    ["deployment.environment"] = builder.Environment.EnvironmentName.ToLowerInvariant()
                }))
            .WithMetrics(meterProviderBuilder => meterProviderBuilder
                .AddRuntimeInstrumentation()
                .AddOtlpExporter(o => o.Endpoint = new Uri(builder.Configuration.GetRequired<string>("AlloyEndpoint"))))
            .WithTracing(tracerProviderBuilder => tracerProviderBuilder
                .SetSampler(new AlwaysOnSampler())
                .AddOtlpExporter(o => o.Endpoint = new Uri(builder.Configuration.GetRequired<string>("AlloyEndpoint"))))
            .UseAzureMonitor().Services
            .AddDataProtection()
            .SetApplicationName(applicationName)
            .PersistKeysToAzureBlobStorage(blobUri, tokenCredential)
            .ProtectKeysWithAzureKeyVault(dataProtectionKeyIdentifier, tokenCredential).Services
            .AddAzureClientsCore(true);
    }
    else
    {
        if (builder.Environment.IsDevelopment())
        {
            builder.Configuration.AddUserSecrets("c7445659-3c3d-4e0e-86ee-d983bd5c741f");
        }

        var secrets = builder.Configuration.GetChurchesSecrets();
        churchesClientId = secrets.ChurchesClientId;
        churchesClientSecret = secrets.ChurchesClientSecret;
        builder.Services
            .AddSerilog((serviceProvider, loggerConfiguration) => loggerConfiguration
                .ReadFrom.Configuration(builder.Configuration)
                .ReadFrom.Services(serviceProvider))
            .AddDataProtection()
            .UseEphemeralDataProtectionProvider();
    }

    builder.Services
        .AddAuthentication(options =>
        {
            options.DefaultScheme = BffAuthenticationSchemes.BffCookie;
            options.DefaultChallengeScheme = BffAuthenticationSchemes.BffOpenIdConnect;
            options.DefaultSignOutScheme = BffAuthenticationSchemes.BffOpenIdConnect;
        }).Services
        .AddBff()
        .AddRemoteApis()
        .ConfigureOpenIdConnect(options =>
        {
            options.Authority = oidcAuthority.ToString();
            options.ClientId = churchesClientId;
            options.ClientSecret = churchesClientSecret;
            foreach (var scope in openIdConnectOptions.Scope)
            {
                options.Scope.Add(scope);
            }

            options.ResponseType = OidcConstants.ResponseTypes.Code;
            options.SaveTokens = openIdConnectOptions.SaveTokens;
            options.GetClaimsFromUserInfoEndpoint = openIdConnectOptions.GetClaimsFromUserInfoEndpoint;
            options.MapInboundClaims = openIdConnectOptions.MapInboundClaims;
            options.TokenValidationParameters = openIdConnectOptions.TokenValidationParameters;
            if (builder.Environment.IsProduction())
            {
                return;
            }

            options.Events = new OpenIdConnectEvents
            {
                OnRedirectToIdentityProvider = context =>
                {
                    var server = context.HttpContext.RequestServices.GetRequiredService<IServer>();
                    var serverAddresses = server.Features.GetRequiredFeature<IServerAddressesFeature>().Addresses;
                    var address = serverAddresses.FirstOrDefault(a => a.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) ?? serverAddresses.FirstOrDefault();
                    if (string.IsNullOrWhiteSpace(address))
                    {
                        return Task.CompletedTask;
                    }

                    context.ProtocolMessage.RedirectUri = address.TrimEnd('/') + options.CallbackPath;
                    return Task.CompletedTask;
                },
                OnRedirectToIdentityProviderForSignOut = context =>
                {
                    var server = context.HttpContext.RequestServices.GetRequiredService<IServer>();
                    var serverAddresses = server.Features.GetRequiredFeature<IServerAddressesFeature>().Addresses;
                    var address = serverAddresses.FirstOrDefault(a => a.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) ?? serverAddresses.FirstOrDefault();
                    if (string.IsNullOrWhiteSpace(address))
                    {
                        return Task.CompletedTask;
                    }

                    context.ProtocolMessage.PostLogoutRedirectUri = address.TrimEnd('/') + options.SignedOutCallbackPath;
                    return Task.CompletedTask;
                }
            };
        })
        .ConfigureCookies(cookieAuthenticationOptions =>
        {
            cookieAuthenticationOptions.Cookie.SameSite = SameSiteMode.Strict;
        }).Services
        .AddAuthorization()
        .AddHealthChecks().Services
        .Configure<ForwardedHeadersOptions>(forwardedHeadersOptions =>
        {
            forwardedHeadersOptions.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            forwardedHeadersOptions.KnownIPNetworks.Clear();
            forwardedHeadersOptions.KnownProxies.Clear();
        });

    var webApplication = builder.Build();
    webApplication.UseForwardedHeaders();
    webApplication.UseSerilogRequestLogging(options => options.EnrichDiagnosticContext = (diagnosticContext, _) =>
    {
        if (Activity.Current is null)
        {
            return;
        }

        diagnosticContext.Set(nameof(Activity.TraceId), Activity.Current.TraceId.ToString());
        diagnosticContext.Set(nameof(Activity.SpanId), Activity.Current.SpanId.ToString());
    });
    if (webApplication.Environment.IsDevelopment())
    {
        webApplication.UseDeveloperExceptionPage();
    }
    else
    {
        webApplication.UseHsts();
    }

    webApplication.UseHttpsRedirection();
    webApplication.Use((ctx, next) =>
    {
        if (ctx.User.Identity?.IsAuthenticated != true)
        {
            return next(ctx);
        }

        using (Serilog.Context.LogContext.PushProperty("UserId", ctx.User.FindFirstValue("sub")))
        using (Serilog.Context.LogContext.PushProperty("UserEmail", ctx.User.FindFirstValue("email")))
        {
            return next(ctx);
        }
    });
    webApplication.MapHealthChecks("/health").DisableHttpMetrics();
    webApplication
        .UseAuthentication()
        .UseBff()
        .UseAuthorization();
    webApplication.MapRemoteBffApiEndpoint("/directory/api", directoryApiAddress).WithAccessToken(RequiredTokenType.UserOrNone);
    webApplication.UseDefaultFiles();
    webApplication.MapStaticAssets();
    webApplication.MapFallbackToFile("/index.html");
    await webApplication.RunAsync();
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    await Log.CloseAndFlushAsync();
}
