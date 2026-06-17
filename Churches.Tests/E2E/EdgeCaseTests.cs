namespace Churches.Tests.E2E;

using System.Text.Json;
using Churches.Tests.Infrastructure;
using Churches.Tests.Infrastructure.Stores;
using Microsoft.Playwright;

[Collection(E2ECollection.Name)]
[Trait("Category", "E2E")]
public sealed class EdgeCaseTests
{
    private readonly ChurchesFixture _fixture;

    public EdgeCaseTests(ChurchesFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task AnonymousNavigation_AcrossPages_ProducesNoUnexpectedConsoleErrors()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var unexpectedErrors = new List<string>();
        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/");
        await using (ctx)
        {
            page.Console += (_, msg) =>
            {
                if (msg.Type == "error" && !msg.Text.Contains("/bff/user") && !msg.Text.Contains("401"))
                {
                    unexpectedErrors.Add(msg.Text);
                }
            };

            await page.GotoAsync("/churches/first-baptist-church-austin-tx", new PageGotoOptions { WaitUntil = WaitUntilState.DOMContentLoaded });
            await Task.Delay(500, TestContext.Current.CancellationToken);
        }

        Assert.Empty(unexpectedErrors);
    }

    [Fact]
    public async Task AuthenticatedNavigation_AcrossPages_ProducesNoConsoleErrors()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var errors = new List<string>();
        var (ctx, page) = await _fixture.NewAuthenticatedPageAsync("/");
        await using (ctx)
        {
            page.Console += (_, msg) =>
            {
                if (msg.Type == "error")
                {
                    errors.Add(msg.Text);
                }
            };

            await page.GotoAsync("/churches/first-baptist-church-austin-tx", new PageGotoOptions { WaitUntil = WaitUntilState.DOMContentLoaded });
            await Task.Delay(500, TestContext.Current.CancellationToken);
        }

        Assert.Empty(errors);
    }

    [Fact]
    public async Task InactiveChurch_InSearchResults_IsHidden()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin with { IsActive = false });

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/churches?q=Baptist&page=1&pageSize=20");
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("text=First Baptist Church Austin")).ToHaveCountAsync(0);
            await Assertions.Expect(page.Locator("text=0 churches found")).ToBeVisibleAsync();
        }
    }

    [Fact]
    public async Task InactiveChurch_OnDetailPage_ShowsNotFoundMessage()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin with { IsActive = false });

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/churches/first-baptist-church-austin-tx");
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("text=Church not found")).ToBeVisibleAsync();
        }
    }

    [Fact]
    public async Task ChurchDetail_WithLowConfidenceScore_RendersSuccessfully()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.MosaicAustin);

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/churches/mosaic-church-austin-tx");
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("h1")).ToContainTextAsync("Mosaic Church Austin");
        }
    }

    [Fact]
    public async Task CorrectionForm_ForFieldWithNullCurrentValue_SubmitsSuccessfully()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.MosaicAustin);
        _fixture.CorrectionStore.Clear();

        var (ctx, page) = await _fixture.NewAuthenticatedPageAsync("/contribute/mosaic-church-austin-tx");
        await using (ctx)
        {
            await page.Locator("select").SelectOptionAsync("phoneNumber");
            await page.GetByRole(AriaRole.Textbox).FillAsync("(512) 555-0100");
            await page.GetByRole(AriaRole.Button, new() { Name = "Submit Correction" }).ClickAsync();
            await Assertions.Expect(page.Locator("text=submitted for review")).ToBeVisibleAsync();
        }
    }

    [Fact]
    public async Task CorrectionForm_WithUnchangedValue_ShowsNoChangeError()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var (ctx, page) = await _fixture.NewAuthenticatedPageAsync("/contribute/first-baptist-church-austin-tx");
        await using (ctx)
        {
            await page.Locator("select").SelectOptionAsync("street");
            await page.GetByRole(AriaRole.Textbox).FillAsync("901 Trinity St");
            await page.GetByRole(AriaRole.Button, new() { Name = "Submit Correction" }).ClickAsync();
            await Assertions.Expect(page.Locator("text=already has that value")).ToBeVisibleAsync();
            await Assertions.Expect(page.Locator("text=submitted for review")).ToHaveCountAsync(0);
        }
    }

    [Fact]
    public async Task ChurchList_WithExactlyPageSizeResults_HidesNextButton()
    {
        _fixture.ChurchStore.Clear();
        for (var i = 0; i < 20; i++)
        {
            _fixture.ChurchStore.Seed(new ChurchRecord(Guid.NewGuid(), $"Church {i:D3}", $"church-{i:D3}-city-tx", 30.0, -97.0, null, "City", "TX", "78700", null, null, null, null, 1, "English", null, null, null, null, 0.5m, null));
        }

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/churches?q=Church&page=1&pageSize=20");
        await using (ctx)
        {
            await Assertions.Expect(page.GetByRole(AriaRole.Button, new() { Name = "Next" })).ToHaveCountAsync(0);
        }
    }
}
