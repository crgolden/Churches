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
        LastVerifiedAt: null)
    {
        Schedules =
        [
            new ScheduleRecord(new Guid("aaaaaaaa-0000-0000-0000-000000000001"), new Guid("11111111-1111-1111-1111-111111111111"), null, 0, "10:00:00", "Sunday Worship"),
            new ScheduleRecord(new Guid("aaaaaaaa-0000-0000-0000-000000000002"), new Guid("11111111-1111-1111-1111-111111111111"), null, 3, "19:00:00", "Bible Study"),
        ],
        Ministries =
        [
            new MinistryRecord(new Guid("bbbbbbbb-0000-0000-0000-000000000001"), new Guid("11111111-1111-1111-1111-111111111111"), "Youth Group", "For teens"),
            new MinistryRecord(new Guid("bbbbbbbb-0000-0000-0000-000000000002"), new Guid("11111111-1111-1111-1111-111111111111"), "Food Bank", null),
        ],
        Campuses =
        [
            new CampusRecord(new Guid("cccccccc-0000-0000-0000-000000000001"), new Guid("11111111-1111-1111-1111-111111111111"), "North Campus", "1200 N Lamar Blvd", "Austin", "TX", "78703", 30.29, -97.75),
        ],
    };

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

    public ScheduleRecord AddSchedule(Guid churchId, int dayOfWeek, string startTime, string? description)
    {
        var record = new ScheduleRecord(Guid.NewGuid(), churchId, null, dayOfWeek, startTime, description);
        if (_churches.TryGetValue(churchId, out var church))
        {
            _churches[churchId] = church with { Schedules = [.. church.Schedules, record] };
        }

        return record;
    }

    public bool RemoveSchedule(Guid id)
    {
        foreach (var (churchId, church) in _churches)
        {
            if (church.Schedules.Any(s => s.Id == id))
            {
                _churches[churchId] = church with { Schedules = church.Schedules.Where(s => s.Id != id).ToList() };
                return true;
            }
        }

        return false;
    }

    public MinistryRecord AddMinistry(Guid churchId, string name, string? description)
    {
        var record = new MinistryRecord(Guid.NewGuid(), churchId, name, description);
        if (_churches.TryGetValue(churchId, out var church))
        {
            _churches[churchId] = church with { Ministries = [.. church.Ministries, record] };
        }

        return record;
    }

    public bool RemoveMinistry(Guid id)
    {
        foreach (var (churchId, church) in _churches)
        {
            if (church.Ministries.Any(m => m.Id == id))
            {
                _churches[churchId] = church with { Ministries = church.Ministries.Where(m => m.Id != id).ToList() };
                return true;
            }
        }

        return false;
    }

    public CampusRecord AddCampus(Guid churchId, string name, string? street, string city, string state, string zip, double latitude, double longitude)
    {
        var record = new CampusRecord(Guid.NewGuid(), churchId, name, street, city, state, zip, latitude, longitude);
        if (_churches.TryGetValue(churchId, out var church))
        {
            _churches[churchId] = church with { Campuses = [.. church.Campuses, record] };
        }

        return record;
    }

    public bool RemoveCampus(Guid id)
    {
        foreach (var (churchId, church) in _churches)
        {
            if (church.Campuses.Any(c => c.Id == id))
            {
                _churches[churchId] = church with { Campuses = church.Campuses.Where(c => c.Id != id).ToList() };
                return true;
            }
        }

        return false;
    }

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

    // Returned only on the church-detail response.
    public IReadOnlyList<ScheduleRecord> Schedules { get; init; } = [];

    public IReadOnlyList<MinistryRecord> Ministries { get; init; } = [];

    public IReadOnlyList<CampusRecord> Campuses { get; init; } = [];
}

public sealed record CampusRecord(
    Guid Id,
    Guid ChurchId,
    string Name,
    string? Street,
    string City,
    string State,
    string Zip,
    double Latitude,
    double Longitude)
{
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; init; } = DateTimeOffset.UtcNow;
}

public sealed record ScheduleRecord(
    Guid Id,
    Guid ChurchId,
    Guid? CampusId,
    int DayOfWeek,
    string StartTime,
    string? Description)
{
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; init; } = DateTimeOffset.UtcNow;
}

public sealed record MinistryRecord(
    Guid Id,
    Guid ChurchId,
    string Name,
    string? Description)
{
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; init; } = DateTimeOffset.UtcNow;
}

public sealed record SearchResult(ChurchRecord Church, double? DistanceMiles);
