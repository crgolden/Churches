namespace Churches.Tests.E2E;

using Churches.Tests.Infrastructure;
using Churches.Tests.Infrastructure.Stores;
using Microsoft.Playwright;

[Collection(E2ECollection.Name)]
[Trait("Category", "E2E")]
public sealed class ChurchDetailTests
{
    private readonly ChurchesFixture _fixture;

    public ChurchDetailTests(ChurchesFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task ChurchDetail_WithFullData_RendersAllFields()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/churches/first-baptist-church-austin-tx");
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("#church-name")).ToContainTextAsync("First Baptist Church Austin");
            await Assertions.Expect(page.Locator("#church-address")).ToContainTextAsync("901 Trinity St");
            await Assertions.Expect(page.Locator("#church-address")).ToContainTextAsync("Austin, TX 78701");
            await Assertions.Expect(page.Locator("#church-phone")).ToBeVisibleAsync();
            await Assertions.Expect(page.Locator("#church-website")).ToBeVisibleAsync();
            await Assertions.Expect(page.Locator("#church-email")).ToBeVisibleAsync();
            await Assertions.Expect(page.Locator("#church-worship-style")).ToHaveTextAsync("Traditional");
            await Assertions.Expect(page.Locator("#church-language")).ToHaveTextAsync("English");
            await Assertions.Expect(page.Locator("#church-wheelchair")).ToBeVisibleAsync();
            await Assertions.Expect(page.Locator("#church-schedules")).ToBeVisibleAsync();
            await Assertions.Expect(page.Locator("#church-schedules")).ToContainTextAsync("Sunday 10:00");
            await Assertions.Expect(page.Locator("#church-schedules")).ToContainTextAsync("Bible Study");
            await Assertions.Expect(page.Locator("#church-ministries")).ToBeVisibleAsync();
            await Assertions.Expect(page.Locator("#church-ministries")).ToContainTextAsync("Youth Group");
            await Assertions.Expect(page.Locator("#church-ministries")).ToContainTextAsync("Food Bank");
            await Assertions.Expect(page.Locator("#church-campuses")).ToBeVisibleAsync();
            await Assertions.Expect(page.Locator("#church-campuses")).ToContainTextAsync("North Campus");
            await Assertions.Expect(page.Locator("#church-campuses")).ToContainTextAsync("1200 N Lamar Blvd");
            await Assertions.Expect(page.Locator("#church-map-section .leaflet-container")).ToBeVisibleAsync();

            // The Location section lives outside the padded body grid; its heading must still line up
            // horizontally with the Contact/About headings (was flush to the card edge before the fix).
            var headingsAligned = await page.EvaluateAsync<bool>(
                @"() => {
                    const contact = document.querySelector('.detail-body .detail-section h4');
                    const location = document.querySelector('#church-map-section h4');
                    if (!contact || !location) return false;
                    return Math.abs(contact.getBoundingClientRect().left - location.getBoundingClientRect().left) < 1;
                }");
            Assert.True(headingsAligned, "Location heading should align with the Contact/About headings.");

            // Main church + one campus marker.
            await Assertions.Expect(page.Locator(".leaflet-marker-icon")).ToHaveCountAsync(2);

            // Same leaflet.css guard as the list map: without the stylesheet the pane/tiles compute
            // position:static and the map renders broken even though markers are present.
            await Assertions.Expect(page.Locator(".leaflet-tile").First).ToBeVisibleAsync();
            var mapPanePosition = await page.EvaluateAsync<string>(
                "() => getComputedStyle(document.querySelector('.leaflet-map-pane')).position");
            Assert.Equal("absolute", mapPanePosition);
            var tilePosition = await page.EvaluateAsync<string>(
                "() => getComputedStyle(document.querySelector('.leaflet-tile')).position");
            Assert.Equal("absolute", tilePosition);
        }
    }

    [Fact]
    public async Task ChurchDetail_WithSparseData_OmitsNullFields()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.MosaicAustin);

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/churches/mosaic-church-austin-tx");
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("#church-name")).ToContainTextAsync("Mosaic Church Austin");
            await Assertions.Expect(page.Locator("#church-phone")).ToHaveCountAsync(0);
            await Assertions.Expect(page.Locator("#church-website")).ToHaveCountAsync(0);
            await Assertions.Expect(page.Locator("#church-wheelchair")).ToHaveCountAsync(0);
            await Assertions.Expect(page.Locator("#church-schedules")).ToHaveCountAsync(0);
            await Assertions.Expect(page.Locator("#church-ministries")).ToHaveCountAsync(0);
            await Assertions.Expect(page.Locator("#church-campuses")).ToHaveCountAsync(0);
        }
    }

    [Fact]
    public async Task ChurchDetail_WithInvalidSlug_ShowsNotFoundMessage()
    {
        _fixture.ChurchStore.Clear();

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/churches/this-slug-does-not-exist");
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("#church-error")).ToBeVisibleAsync();
        }
    }

    [Fact]
    public async Task ChurchDetail_WhenAnonymous_HidesContributeLink()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/churches/first-baptist-church-austin-tx");
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("#contribute-link")).ToHaveCountAsync(0);
        }
    }

    [Fact]
    public async Task ChurchDetail_AsModerator_CanAddAndDeleteSchedule()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.MosaicAustin);

        var (ctx, page) = await _fixture.NewAuthenticatedPageAsync("/churches/mosaic-church-austin-tx", isModerator: true);
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("#church-name")).ToContainTextAsync("Mosaic Church Austin");

            // Render guard: the add-forms must be laid out usably, not stacked flush with no spacing.
            // A zero-CSS regression (no .mod-add-grid styling) leaves the wrapper as a plain block with
            // no gap, and the per-field labels missing — both checked here so the defect can't recur.
            await Assertions.Expect(page.Locator("label[for='schedule-day']")).ToBeVisibleAsync();
            await Assertions.Expect(page.Locator("label[for='schedule-time']")).ToBeVisibleAsync();
            var gridDisplay = await page.EvaluateAsync<string>(
                "() => getComputedStyle(document.querySelector('.mod-add-grid')).display");
            Assert.Equal("grid", gridDisplay);
            var gridRowGap = await page.EvaluateAsync<string>(
                "() => getComputedStyle(document.querySelector('.mod-add-grid')).rowGap");
            Assert.NotEqual("0px", gridRowGap);
            Assert.NotEqual("normal", gridRowGap);

            // Moderators see the add form even with no existing schedules.
            await page.GetByLabel("Day of week").SelectOptionAsync(new SelectOptionValue { Label = "Wednesday" });
            await page.GetByLabel("Start time").FillAsync("19:00");
            await page.GetByLabel("Schedule description").FillAsync("Midweek Prayer");
            await page.Locator("#add-schedule").ClickAsync();

            await Assertions.Expect(page.Locator("#church-schedules")).ToContainTextAsync("Wednesday 19:00");
            await Assertions.Expect(page.Locator("#church-schedules")).ToContainTextAsync("Midweek Prayer");

            // Delete it again.
            await page.Locator("#church-schedules button[aria-label='Delete schedule']").ClickAsync();
            await Assertions.Expect(page.Locator("#church-schedules li")).ToHaveCountAsync(0);
        }
    }

    [Fact]
    public async Task ChurchDetail_AsModerator_CanAddMinistry()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.MosaicAustin);

        var (ctx, page) = await _fixture.NewAuthenticatedPageAsync("/churches/mosaic-church-austin-tx", isModerator: true);
        await using (ctx)
        {
            await page.GetByLabel("Ministry name").FillAsync("Recovery Group");
            await page.Locator("#add-ministry").ClickAsync();

            await Assertions.Expect(page.Locator("#church-ministries")).ToContainTextAsync("Recovery Group");
        }
    }

    [Fact]
    public async Task ChurchDetail_WhenAuthenticated_ShowsContributeLink()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var (ctx, page) = await _fixture.NewAuthenticatedPageAsync("/churches/first-baptist-church-austin-tx");
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("#contribute-link")).ToBeVisibleAsync();
        }
    }
}
