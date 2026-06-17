namespace Churches.Tests.Infrastructure.Stores;

using System.Collections.Concurrent;

public sealed class CorrectionStore
{
    private readonly ConcurrentDictionary<Guid, CorrectionRecord> _corrections = new();

    public void Seed(CorrectionRecord record) => _corrections[record.Id] = record;

    public void Clear() => _corrections.Clear();

    public CorrectionRecord Submit(Guid churchId, string userId, string field, string? oldValue, string newValue, string? churchName = null)
    {
        var record = new CorrectionRecord(
            Id: Guid.NewGuid(),
            ChurchId: churchId,
            UserId: userId,
            Field: field,
            OldValue: oldValue,
            NewValue: newValue,
            Status: 0,
            ReviewedBy: null,
            ReviewedAt: null,
            CreatedAt: DateTimeOffset.UtcNow,
            ChurchName: churchName);
        _corrections[record.Id] = record;
        return record;
    }

    public bool Approve(Guid id)
    {
        if (!_corrections.TryGetValue(id, out var existing) || existing.Status != 0)
        {
            return false;
        }

        _corrections[id] = existing with { Status = 1, ReviewedBy = "e2e-mod-id", ReviewedAt = DateTimeOffset.UtcNow };
        return true;
    }

    public bool Reject(Guid id)
    {
        if (!_corrections.TryGetValue(id, out var existing) || existing.Status != 0)
        {
            return false;
        }

        _corrections[id] = existing with { Status = 2, ReviewedBy = "e2e-mod-id", ReviewedAt = DateTimeOffset.UtcNow };
        return true;
    }

    public (IReadOnlyList<CorrectionRecord> Items, int TotalCount) GetPending(int page, int pageSize)
    {
        var all = _corrections.Values.Where(c => c.Status == 0).OrderByDescending(c => c.CreatedAt).ToList();
        var total = all.Count;
        var items = all.Skip((page - 1) * pageSize).Take(pageSize).ToList();
        return (items, total);
    }
}

public sealed record CorrectionRecord(
    Guid Id,
    Guid ChurchId,
    string UserId,
    string Field,
    string? OldValue,
    string NewValue,
    int Status,
    string? ReviewedBy,
    DateTimeOffset? ReviewedAt,
    DateTimeOffset CreatedAt,
    string? ChurchName);
