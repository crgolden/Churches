namespace Churches.Tests.Infrastructure;

using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

public sealed class ChurchesWebApplicationFactory : IAsyncDisposable
{
    private WebApplication? _app;
    private string? _serverAddress;

    public string ServerAddress => _serverAddress
        ?? throw new InvalidOperationException("Server address is not available. Call StartAsync() first.");

    public async Task StartAsync()
    {
        if (_app is not null)
        {
            return;
        }

        Stage("StartAsync enter: creating builder");

        var contentRoot = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Churches.Server"));

        var distPath = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "churches.client", "dist", "churches.client", "browser"));

        var options = new WebApplicationOptions
        {
            EnvironmentName = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development",
            ContentRootPath = contentRoot,
            ApplicationName = "Churches.Server",
            WebRootPath = Directory.Exists(distPath) ? distPath : null
        };
        var builder = WebApplication.CreateBuilder(options);

        builder.WebHost.ConfigureKestrel(o => o.Listen(IPAddress.Loopback, 0, lo => lo.UseHttps()));

        builder.Services.Configure<HostOptions>(opts =>
            opts.BackgroundServiceExceptionBehavior = BackgroundServiceExceptionBehavior.Ignore);

        builder.Services.AddLogging(lb => lb.AddConsole());

        Stage("Services configured; building app");
        _app = builder.Build();

        _app.UseDefaultFiles();
        _app.UseStaticFiles();
        _app.MapFallbackToFile("/index.html");

        Stage("App built; starting");
        await _app.StartAsync();

        var server = _app.Services.GetRequiredService<IServer>();
        var addresses = server.Features.GetRequiredFeature<IServerAddressesFeature>();
        _serverAddress = addresses.Addresses.First().TrimEnd('/');
        Stage($"StartAsync exit: {_serverAddress}");
    }

    public async ValueTask DisposeAsync()
    {
        if (_app is not null)
        {
            await _app.StopAsync();
            await _app.DisposeAsync();
            _app = null;
        }
    }

    private static void Stage(string msg) =>
        Console.WriteLine($"[{DateTime.UtcNow:HH:mm:ss.fff}] Factory: {msg}");
}
