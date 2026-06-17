namespace Churches.Tests.E2E;

using Churches.Tests.Infrastructure;
using Churches.Tests.Infrastructure.Stores;
using Microsoft.Playwright;

[Collection(E2ECollection.Name)]
[Trait("Category", "E2E")]
public sealed class AnonymousTests
{
    private readonly ChurchesFixture _fixture;

    public AnonymousTests(ChurchesFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task HomePage_OnLoad_ShowsSearchFormAndHeading()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/");
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("h1")).ToContainTextAsync("Find Your Church Home");
            await Assertions.Expect(page.GetByRole(AriaRole.Textbox).First).ToBeVisibleAsync();
            await Assertions.Expect(page.GetByRole(AriaRole.Button, new() { Name = "Search" })).ToBeVisibleAsync();
        }
    }

    [Fact]
    public async Task SearchForm_WithKeyword_NavigatesToResultsPage()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/");
        await using (ctx)
        {
            await page.GetByRole(AriaRole.Textbox).First.FillAsync("Baptist");
            await page.GetByRole(AriaRole.Button, new() { Name = "Search" }).ClickAsync();
            await page.WaitForURLAsync("**/churches**");
            await Assertions.Expect(page.Locator("text=First Baptist Church Austin")).ToBeVisibleAsync();
        }
    }

    [Fact]
    public async Task SearchForm_WithStateFilter_ShowsMatchingChurches()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);
        _fixture.ChurchStore.Seed(ChurchStore.MosaicAustin);

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/");
        await using (ctx)
        {
            await page.Locator("input[placeholder*='State'], input[name*='state'], input[id*='state']").First.FillAsync("TX");
            await page.GetByRole(AriaRole.Button, new() { Name = "Search" }).ClickAsync();
            await page.WaitForURLAsync("**/churches**");
            await Assertions.Expect(page.Locator("text=Austin, TX").First).ToBeVisibleAsync();
        }
    }

    [Fact]
    public async Task SearchForm_WithWorshipStyleFilter_NavigatesToResultsPage()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/");
        await using (ctx)
        {
            await page.Locator("select").SelectOptionAsync("1");
            await page.GetByRole(AriaRole.Button, new() { Name = "Search" }).ClickAsync();
            await page.WaitForURLAsync("**/churches**");
            Assert.Contains("/churches", page.Url, StringComparison.Ordinal);
        }
    }

    [Fact]
    public async Task SearchForm_WithWheelchairFilter_NavigatesToResultsPage()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/");
        await using (ctx)
        {
            await page.Locator("input[type='checkbox']").CheckAsync();
            await page.GetByRole(AriaRole.Button, new() { Name = "Search" }).ClickAsync();
            await page.WaitForURLAsync("**/churches**");
            Assert.Contains("/churches", page.Url, StringComparison.Ordinal);
        }
    }

    [Fact]
    public async Task SearchForm_WithNoMatchingKeyword_ShowsZeroResults()
    {
        _fixture.ChurchStore.Clear();

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/");
        await using (ctx)
        {
            await page.GetByRole(AriaRole.Textbox).First.FillAsync("zzz_no_match_zzz");
            await page.GetByRole(AriaRole.Button, new() { Name = "Search" }).ClickAsync();
            await page.WaitForURLAsync("**/churches**");
            await Assertions.Expect(page.Locator("text=0 churches found")).ToBeVisibleAsync();
        }
    }

    [Fact]
    public async Task NearMeButton_OnClick_ProducesNoConsoleErrors()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var consoleErrors = new List<string>();
        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/");
        await using (ctx)
        {
            page.Console += (_, msg) =>
            {
                if (msg.Type == "error")
                {
                    consoleErrors.Add(msg.Text);
                }
            };

            await page.GetByRole(AriaRole.Button, new() { Name = "Near Me" }).ClickAsync();
            await Task.Delay(500, TestContext.Current.CancellationToken);
            Assert.DoesNotContain(consoleErrors, e => !e.Contains("/bff/user") && !e.Contains("401"));
        }
    }

    [Fact]
    public async Task SearchForm_WhenEnterKeyPressed_NavigatesToResultsPage()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/");
        await using (ctx)
        {
            var input = page.GetByRole(AriaRole.Textbox).First;
            await input.FillAsync("Baptist");
            await input.PressAsync("Enter");
            await page.WaitForURLAsync("**/churches**");
            Assert.Contains("/churches", page.Url, StringComparison.Ordinal);
        }
    }

    [Fact]
    public async Task ChurchList_WithResults_DisplaysResultCount()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);
        _fixture.ChurchStore.Seed(ChurchStore.MosaicAustin);

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/churches?q=Austin&page=1&pageSize=20");
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("text=churches found")).ToBeVisibleAsync();
        }
    }

    [Fact]
    public async Task ChurchList_EachCard_ShowsNameLinkAndLocation()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/churches?q=Baptist&page=1&pageSize=20");
        await using (ctx)
        {
            await Assertions.Expect(page.Locator("a", new() { HasText = "First Baptist Church Austin" })).ToBeVisibleAsync();
            await Assertions.Expect(page.Locator("text=Austin, TX")).ToBeVisibleAsync();
        }
    }

    [Fact]
    public async Task ChurchList_WithoutGeolocation_OmitsDistanceColumn()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/churches?q=Baptist&page=1&pageSize=20");
        await using (ctx)
        {
            var milesText = page.Locator("text=miles away");
            await Assertions.Expect(milesText).ToHaveCountAsync(0);
        }
    }

    [Fact]
    public async Task ChurchList_WhenMoreResultsThanPageSize_ShowsNextButton()
    {
        _fixture.ChurchStore.Clear();
        for (var i = 0; i < 25; i++)
        {
            _fixture.ChurchStore.Seed(new ChurchRecord(Guid.NewGuid(), $"Church {i:D3}", $"church-{i:D3}-city-tx", 30.0, -97.0, null, "City", "TX", "78700", null, null, null, null, 1, "English", null, null, null, null, 0.5m, null));
        }

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/churches?q=Church&page=1&pageSize=20");
        await using (ctx)
        {
            await Assertions.Expect(page.GetByRole(AriaRole.Button, new() { Name = "Next" })).ToBeVisibleAsync();
            await Assertions.Expect(page.GetByRole(AriaRole.Button, new() { Name = "Previous" })).ToHaveCountAsync(0);
        }
    }

    [Fact]
    public async Task ChurchList_OnFinalPage_ShowsPreviousButtonOnly()
    {
        _fixture.ChurchStore.Clear();
        for (var i = 0; i < 25; i++)
        {
            _fixture.ChurchStore.Seed(new ChurchRecord(Guid.NewGuid(), $"Church {i:D3}", $"church-{i:D3}-city-tx", 30.0, -97.0, null, "City", "TX", "78700", null, null, null, null, 1, "English", null, null, null, null, 0.5m, null));
        }

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/churches?q=Church&page=2&pageSize=20");
        await using (ctx)
        {
            await Assertions.Expect(page.GetByRole(AriaRole.Button, new() { Name = "Previous" })).ToBeVisibleAsync();
            await Assertions.Expect(page.GetByRole(AriaRole.Button, new() { Name = "Next" })).ToHaveCountAsync(0);
        }
    }

    [Fact]
    public async Task ChurchList_ClickingChurchName_NavigatesToDetailPage()
    {
        _fixture.ChurchStore.Clear();
        _fixture.ChurchStore.Seed(ChurchStore.FirstBaptistAustin);

        var (ctx, page) = await _fixture.NewAnonymousPageAsync("/churches?q=Baptist&page=1&pageSize=20");
        await using (ctx)
        {
            await page.Locator("a", new() { HasText = "First Baptist Church Austin" }).ClickAsync();
            await page.WaitForURLAsync("**/churches/first-baptist-church-austin-tx**");
            await Assertions.Expect(page.Locator("h1")).ToContainTextAsync("First Baptist Church Austin");
        }
    }
}
