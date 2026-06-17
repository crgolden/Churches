namespace Churches.Tests.Infrastructure.Stores;

using System.Collections.Concurrent;

public sealed class ChurchStore
{
    public static readonly ChurchRecord FirstBaptistAustin = new(
        Id: new Guid("11111111-1111-1111-1111-111111111111"),
        CanonicalName: "First Baptist Church Austin",
        Slug: "first-baptist-church-austin-tx",
        Latitude: 30.2672,
        Longitude: -97.7431,
        Street: "901 Trinity St",
        City: "Austin",
        State: "TX",
        Zip: "78701",
        PhoneNumber: "(512) 476-2625",
        Website: "https://fbcaustin.org",
        EmailAddress: "info@fbcaustin.org",
        DenominationId: null,
        WorshipStyle: 1,
        PrimaryLanguage: "English",
        AcceptsLGBTQ: null,
        WheelchairAccessible: true,
        HasNursery: true,
        HasYouthProgram: true,
        ConfidenceScore: 0.85m,
        LastVerifiedAt: null);

    public static readonly ChurchRecord MosaicAustin = new(
        Id: new Guid("22222222-2222-2222-2222-222222222222"),
        CanonicalName: "Mosaic Church Austin",
        Slug: "mosaic-church-austin-tx",
        Latitude: 30.2700,
        Longitude: -97.7500,
        Street: null,
        City: "Austin",
        State: "TX",
        Zip: "78702",
        PhoneNumber: null,
        Website: null,
        EmailAddress: null,
        DenominationId: null,
        WorshipStyle: 2,
        PrimaryLanguage: "English",
        AcceptsLGBTQ: null,
        WheelchairAccessible: null,
        HasNursery: null,
        HasYouthProgram: null,
        ConfidenceScore: 0.20m,
        LastVerifiedAt: null);

    private readonly ConcurrentDictionary<Guid, ChurchRecord> _churches = new();

    public void Seed(ChurchRecord record) => _churches[record.Id] = record;

    public void Clear() => _churches.Clear();

    public ChurchRecord? GetBySlug(string slug) =>
        _churches.Values.FirstOrDefault(c => c.Slug == slug && c.IsActive);

    public (IReadOnlyList<ChurchRecord> Items, int TotalCount) GetPage(int page, int pageSize)
    {
        var all = _churches.Values.Where(c => c.IsActive).OrderBy(c => c.CanonicalName).ToList();
        var total = all.Count;
        var items = all.Skip((page - 1) * pageSize).Take(pageSize).ToList();
        return (items, total);
    }

    public (IReadOnlyList<SearchResult> Items, int TotalCount) Search(
        string? q,
        string? state,
        int? worshipStyle,
        bool? wheelchairAccessible,
        int page,
        int pageSize)
    {
        var query = _churches.Values.Where(c => c.IsActive).AsEnumerable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            query = query.Where(c =>
                c.CanonicalName.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                c.City.Contains(q, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(state))
        {
            query = query.Where(c => c.State.Equals(state, StringComparison.OrdinalIgnoreCase));
        }

        if (worshipStyle.HasValue)
        {
            query = query.Where(c => c.WorshipStyle == worshipStyle.Value);
        }

        if (wheelchairAccessible.HasValue)
        {
            query = query.Where(c => c.WheelchairAccessible == wheelchairAccessible.Value);
        }

        var all = query.OrderBy(c => c.CanonicalName).ToList();
        var total = all.Count;
        var items = all.Skip((page - 1) * pageSize).Take(pageSize)
            .Select(c => new SearchResult(c, null))
            .ToList();
        return (items, total);
    }
}

public sealed record ChurchRecord(
    Guid Id,
    string CanonicalName,
    string Slug,
    double Latitude,
    double Longitude,
    string? Street,
    string City,
    string State,
    string Zip,
    string? PhoneNumber,
    string? Website,
    string? EmailAddress,
    Guid? DenominationId,
    int WorshipStyle,
    string PrimaryLanguage,
    bool? AcceptsLGBTQ,
    bool? WheelchairAccessible,
    bool? HasNursery,
    bool? HasYouthProgram,
    decimal ConfidenceScore,
    DateTimeOffset? LastVerifiedAt,
    bool IsActive = true)
{
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; init; } = DateTimeOffset.UtcNow;
}

public sealed record SearchResult(ChurchRecord Church, double? DistanceMiles);
