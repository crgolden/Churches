namespace Churches.Tests.E2E;

using Churches.Tests.Infrastructure;
using Churches.Tests.Infrastructure.Stores;
using Microsoft.Playwright;

[Collection(E2ECollection.Name)]
[Trait("Category", "E2E")]
public sealed class ModerationTests
{
    private readonly ChurchesFixture _fixture;

    public ModerationTests(ChurchesFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task ModerationPage_WhenNotModerator_RedirectsToHome()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);
        _fixture.CorrectionStore.Clear();

        var (ctx, page) = await _fixture.NewAuthenticatedPageAsync("/admin/moderation", isModerator: false);
        await using (ctx)
        {
            await page.WaitForFunctionAsync("() => window.location.pathname === '/'", null, new PageWaitForFunctionOptions { Timeout = 10_000 });
            Assert.Equal("/", new Uri(page.Url).AbsolutePath);
        }
    }

    [Fact]
    public async Task ModerationQueue_WhenModerator_ShowsPendingCorrections()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);
        _fixture.CorrectionStore.Clear();
        _fixture.CorrectionStore.Seed(new CorrectionRecord(
            Guid.NewGuid(),
            ChurchStore.FirstBaptistAustin.Id,
            "some-user-id",
            "street",
            "901 Trinity St",
            "999 New St",
            0,
            null,
            null,
            DateTimeOffset.UtcNow,
            "First Baptist Church Austin"));

        var (ctx, page) = await _fixture.NewAuthenticatedPageAsync("/admin/moderation", isModerator: true);
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("h1")).ToContainTextAsync("Moderation Queue");
            await Assertions.Expect(page.Locator("text=First Baptist Church Austin")).ToBeVisibleAsync();
            await Assertions.Expect(page.Locator("text=999 New St")).ToBeVisibleAsync();
        }
    }

    [Fact]
    public async Task ModerationQueue_ApprovingCorrection_RemovesFromQueue()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);
        _fixture.CorrectionStore.Clear();
        _fixture.CorrectionStore.Seed(new CorrectionRecord(
            Guid.NewGuid(),
            ChurchStore.FirstBaptistAustin.Id,
            "some-user-id",
            "street",
            "901 Trinity St",
            "999 New St",
            0,
            null,
            null,
            DateTimeOffset.UtcNow,
            "First Baptist Church Austin"));

        var (ctx, page) = await _fixture.NewAuthenticatedPageAsync("/admin/moderation", isModerator: true);
        await using (ctx)
        {
            await page.GetByRole(AriaRole.Button, new() { Name = "Approve" }).ClickAsync();
            await Assertions.Expect(page.Locator("text=No pending corrections")).ToBeVisibleAsync();
        }
    }

    [Fact]
    public async Task ModerationQueue_RejectingCorrection_RemovesFromQueue()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);
        _fixture.CorrectionStore.Clear();
        _fixture.CorrectionStore.Seed(new CorrectionRecord(
            Guid.NewGuid(),
            ChurchStore.FirstBaptistAustin.Id,
            "some-user-id",
            "street",
            "901 Trinity St",
            "999 New St",
            0,
            null,
            null,
            DateTimeOffset.UtcNow,
            "First Baptist Church Austin"));

        var (ctx, page) = await _fixture.NewAuthenticatedPageAsync("/admin/moderation", isModerator: true);
        await using (ctx)
        {
            await page.GetByRole(AriaRole.Button, new() { Name = "Reject" }).ClickAsync();
            await Assertions.Expect(page.Locator("text=No pending corrections")).ToBeVisibleAsync();
        }
    }

    [Fact]
    public async Task ModerationQueue_WhenEmpty_ShowsEmptyState()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);
        _fixture.CorrectionStore.Clear();

        var (ctx, page) = await _fixture.NewAuthenticatedPageAsync("/admin/moderation", isModerator: true);
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("text=No pending corrections")).ToBeVisibleAsync();
        }
    }
}
