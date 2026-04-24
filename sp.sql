SELECT
    id,
    depot_id,
    asset_id,
    worth,
    DATE(ds.last_executed + depots.sp_to_interval(ds.period)) AS next_execute
FROM depots.savings_plans AS ds
WHERE ds.last_executed + depots.sp_to_interval(ds.period) <= CURRENT_DATE;
