using System.Collections.Concurrent;
using System.Reflection;
using System.Text.Json;
using Microsoft.Playwright;
using Xunit;
using Xunit.v3;

[assembly: Churches.Tests.Infrastructure.PlaywrightArtifactFinalizer]

namespace Churches.Tests.Infrastructure;

[AttributeUsage(AttributeTargets.Assembly | AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true, Inherited = true)]
public sealed class PlaywrightArtifactFinalizerAttribute : BeforeAfterTestAttribute
{
    public override void Before(MethodInfo methodUnderTest, IXunitTest test) =>
        PlaywrightArtifactRecorder.Clear(test.UniqueID);

    public override void After(MethodInfo methodUnderTest, IXunitTest test)
    {
        var state = TestContext.Current.TestState;
        PlaywrightArtifactRecorder.Finalize(test.UniqueID, state);
    }
}

internal sealed class PlaywrightArtifactSession : IAsyncDisposable
{
    private readonly PlaywrightArtifactRecorder _recorder;
    private readonly IBrowserContext _context;
    private readonly IPage _page;
    private bool _disposed;

    public PlaywrightArtifactSession(PlaywrightArtifactRecorder recorder, IBrowserContext context, IPage page)
    {
        _recorder = recorder;
        _context = context;
        _page = page;
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        await _recorder.CompleteAsync(_context, _page);
    }
}

internal sealed class PlaywrightArtifactRecorder
{
    private const string TempFolderName = ".tmp";
    private static readonly ConcurrentDictionary<string, ConcurrentBag<PendingArtifact>> PendingArtifacts = new();

    private readonly string _appName;
    private readonly string _suiteName;
    private readonly string _testId;
    private readonly string _testName;
    private readonly string _artifactName;
    private readonly string _tempDirectory;
    private readonly string _finalDirectory;
    private readonly bool _belongsToTest;
    private readonly List<string> _events = [];
    private readonly DateTimeOffset _startedAt = DateTimeOffset.UtcNow;

    private PlaywrightArtifactRecorder(string appName, string suiteName)
    {
        var test = TestContext.Current.Test;
        _appName = appName;
        _suiteName = suiteName;
        _belongsToTest = test is not null;
        _testId = test?.UniqueID ?? $"unknown-{Guid.NewGuid():N}";
        _testName = test?.TestDisplayName ?? "Unknown test";
        _artifactName = Sanitize(_testName);

        var root = Path.Combine(AppContext.BaseDirectory, "TestResults", "PlaywrightArtifacts");
        _tempDirectory = Path.Combine(root, TempFolderName, _testId, Guid.NewGuid().ToString("N"));
        _finalDirectory = Path.Combine(root, _suiteName, _artifactName);
        Directory.CreateDirectory(_tempDirectory);
    }

    public static async Task<(IAsyncDisposable Context, IPage Page)> CreateSessionAsync(
        IBrowser browser,
        string appName,
        string suiteName,
        BrowserNewContextOptions options)
    {
        var recorder = new PlaywrightArtifactRecorder(appName, suiteName);
        options.RecordVideoDir = recorder._tempDirectory;
        options.RecordVideoSize = new() { Width = 1280, Height = 720 };

        var context = await browser.NewContextAsync(options);
        await context.Tracing.StartAsync(new()
        {
            Screenshots = true,
            Snapshots = true,
            Sources = true
        });

        var page = await context.NewPageAsync();
        recorder.Attach(page);
        return (new PlaywrightArtifactSession(recorder, context, page), page);
    }

    public static void Clear(string testId)
    {
        if (PendingArtifacts.TryRemove(testId, out var artifacts))
        {
            foreach (var artifact in artifacts)
            {
                DeleteDirectory(artifact.TempDirectory);
            }
        }
    }

    public static void Finalize(string testId, TestResultState? state)
    {
        if (!PendingArtifacts.TryRemove(testId, out var artifacts))
        {
            return;
        }

        var failed = state?.Result == TestResult.Failed;
        foreach (var artifact in artifacts)
        {
            var tempParent = Path.GetDirectoryName(artifact.TempDirectory);
            if (!failed)
            {
                DeleteDirectory(artifact.TempDirectory);
                DeleteDirectoryIfEmpty(tempParent);
                continue;
            }

            Directory.CreateDirectory(artifact.FinalDirectory);
            var targetDirectory = Path.Combine(artifact.FinalDirectory, artifact.ContextId);
            if (Directory.Exists(targetDirectory))
            {
                DeleteDirectory(targetDirectory);
            }

            Directory.Move(artifact.TempDirectory, targetDirectory);
            DeleteDirectoryIfEmpty(tempParent);
            WriteFailureMetadata(targetDirectory, state);
        }
    }

    public void Attach(IPage page)
    {
        page.Console += (_, msg) => AddEvent($"CONSOLE {msg.Type} {msg.Text}");
        page.PageError += (_, error) => AddEvent($"PAGEERROR {error}");
        page.Request += (_, request) => AddEvent($"REQ {request.Method} {request.Url}");
        page.Response += (_, response) => AddEvent($"RESP {response.Status} {response.Url}");
        page.RequestFailed += (_, request) => AddEvent($"FAIL {request.Method} {request.Url} err={request.Failure}");
    }

    public async Task CompleteAsync(IBrowserContext context, IPage page)
    {
        try
        {
            await page.ScreenshotAsync(new()
            {
                Path = Path.Combine(_tempDirectory, "screenshot.png"),
                FullPage = true
            });
        }
        catch (Exception ex)
        {
            AddEvent($"SCREENSHOT_ERROR {ex.GetType().Name}: {ex.Message}");
        }

        try
        {
            await context.Tracing.StopAsync(new() { Path = Path.Combine(_tempDirectory, "trace.zip") });
        }
        catch (Exception ex)
        {
            AddEvent($"TRACE_ERROR {ex.GetType().Name}: {ex.Message}");
        }

        try
        {
            await context.DisposeAsync();
        }
        catch (Exception ex)
        {
            AddEvent($"CONTEXT_DISPOSE_ERROR {ex.GetType().Name}: {ex.Message}");
        }

        await File.WriteAllLinesAsync(Path.Combine(_tempDirectory, "browser-log.txt"), _events);
        await WriteMetadataAsync(Path.Combine(_tempDirectory, "metadata.json"));
        if (!_belongsToTest)
        {
            var parent = Path.GetDirectoryName(_tempDirectory);
            DeleteDirectory(_tempDirectory);
            DeleteDirectoryIfEmpty(parent);
            return;
        }

        PendingArtifacts.GetOrAdd(_testId, _ => []).Add(new PendingArtifact(_tempDirectory, _finalDirectory, Guid.NewGuid().ToString("N")));
    }

    private static void WriteFailureMetadata(string directory, TestResultState? state)
    {
        var path = Path.Combine(directory, "failure.json");
        var payload = new
        {
            outcome = state?.Result.ToString(),
            executionTimeSeconds = state?.ExecutionTime,
            exceptionTypes = state?.ExceptionTypes,
            exceptionMessages = state?.ExceptionMessages,
            exceptionStackTraces = state?.ExceptionStackTraces,
            failureCause = state?.FailureCause?.ToString()
        };
        File.WriteAllText(path, JsonSerializer.Serialize(payload, JsonOptions()));
    }

    private static JsonSerializerOptions JsonOptions() => new() { WriteIndented = true };

    private static string Sanitize(string value)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var chars = value.Select(ch => invalid.Contains(ch) || char.IsWhiteSpace(ch) ? '_' : ch).ToArray();
        var sanitized = new string(chars);
        return sanitized.Length <= 120 ? sanitized : sanitized[..120];
    }

    private static void DeleteDirectory(string directory)
    {
        if (Directory.Exists(directory))
        {
            Directory.Delete(directory, recursive: true);
        }
    }

    private static void DeleteDirectoryIfEmpty(string? directory)
    {
        if (directory is not null && Directory.Exists(directory) && !Directory.EnumerateFileSystemEntries(directory).Any())
        {
            Directory.Delete(directory);
        }
    }

    private void AddEvent(string message)
    {
        lock (_events)
        {
            _events.Add($"[{DateTimeOffset.UtcNow:O}] {message}");
        }
    }

    private async Task WriteMetadataAsync(string path)
    {
        var payload = new
        {
            app = _appName,
            suite = _suiteName,
            testId = _testId,
            testName = _testName,
            artifactName = _artifactName,
            startedAt = _startedAt,
            completedAt = DateTimeOffset.UtcNow,
            githubRunId = Environment.GetEnvironmentVariable("GITHUB_RUN_ID"),
            githubRunAttempt = Environment.GetEnvironmentVariable("GITHUB_RUN_ATTEMPT"),
            githubRepository = Environment.GetEnvironmentVariable("GITHUB_REPOSITORY"),
            githubSha = Environment.GetEnvironmentVariable("GITHUB_SHA"),
            githubRef = Environment.GetEnvironmentVariable("GITHUB_REF")
        };
        await File.WriteAllTextAsync(path, JsonSerializer.Serialize(payload, JsonOptions()));
    }

    private sealed class PendingArtifact(string tempDirectory, string finalDirectory, string contextId)
    {
        public string TempDirectory { get; } = tempDirectory;

        public string FinalDirectory { get; } = finalDirectory;

        public string ContextId { get; } = contextId;
    }
}
