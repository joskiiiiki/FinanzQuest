CREATE OR REPLACE FUNCTION depots.update_depot_positions () RETURNS VOID
LANGUAGE plpgsql -- Changed from SQL to plpgsql
AS $$
BEGIN
    WITH latest_prices AS (
        SELECT DISTINCT ON (asset_id)
            asset_id,
            tstamp,
            close
        FROM api.asset_prices
        ORDER BY asset_id, tstamp DESC
    )
    UPDATE depots.positions as dp
    SET
        price = latest_prices.close,
        worth = latest_prices.close * amount,
        last = latest_prices.tstamp
    FROM latest_prices
    WHERE
        dp.last <= latest_prices.tstamp -- Changed comma to proper condition
        AND dp.asset_id = latest_prices.asset_id;  -- Use AND, not comma
END;
$$ ;

CREATE OR REPLACE FUNCTION depots.log_transaction (p_asset_id BIGINT,
p_depot_id BIGINT,
p_amount REAL,
p_price REAL,
p_commission REAL) RETURNS VOID
LANGUAGE plpgsql AS $$
    BEGIN
        INSERT INTO depots.transactions (asset_id, depot_id, amount, price, tstamp, commission )
        VALUES (p_asset_id, p_depot_id, p_amount, p_price, NOW(), p_commission);
    END;
$$ ;

CREATE OR REPLACE FUNCTION depots.buy_asset (
p_asset_id BIGINT,
p_depot_id BIGINT,
p_worth REAL
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    price REAL;
    price_tstamp DATE;
    asset_amount REAL;
    total_cost REAL;
    depot_cash REAL;
    commission REAL;
BEGIN
    -- Get commission from configuration
    commission := current_setting('config.commission')::REAL;


    -- Find the asset's current price
    SELECT prices.close, prices.tstamp
    FROM api.asset_prices AS prices
    WHERE prices.asset_id = p_asset_id
    ORDER BY prices.tstamp DESC
    LIMIT 1
    INTO price, price_tstamp;


    -- Check if price was found
    IF price IS NULL THEN
        RAISE EXCEPTION 'No price found for asset_id %', p_asset_id;
    END IF;

    asset_amount := p_worth / price;
    total_cost := p_worth + commission;


    -- Verify that the depot has enough cash
    SELECT d.cash
    FROM depots.depots d
    WHERE d.id = p_depot_id
    INTO depot_cash;

    -- Check if depot exists
    IF depot_cash IS NULL THEN
        RAISE EXCEPTION 'Depot with id % not found', p_depot_id;
    END IF;

    IF depot_cash < total_cost THEN
        RAISE EXCEPTION 'Insufficient cash in depot. Required: %, Available: %', total_cost, depot_cash;
    END IF;

    -- Subtract the cash
    UPDATE depots.depots
    SET cash = cash - total_cost
    WHERE id = p_depot_id;

    -- Buy/update position
    INSERT INTO depots.positions (depot_id, asset_id, price, amount, worth, last)
    VALUES (p_depot_id, p_asset_id, price, asset_amount, p_worth, price_tstamp)
    ON CONFLICT (depot_id, asset_id) DO UPDATE
    SET
        amount = positions.amount + EXCLUDED.amount,
        worth = positions.worth + EXCLUDED.worth,
        price = EXCLUDED.price,
        last = EXCLUDED.last;


    PERFORM log_transaction (p_asset_id, p_depot_id, asset_amount, price, commission);
END;
$$ ;

CREATE OR REPLACE FUNCTION depots.sell_asset (
p_asset_id BIGINT,
p_depot_id BIGINT,
p_worth REAL
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    price REAL;
    price_tstamp DATE;
    asset_amount REAL;
    total_profit REAL;
    possessed_worth REAL;
    commission REAL;
    worth_to_sell REAL;
BEGIN
    -- Get commission from configuration
    commission := current_setting('config.commission')::REAL;

    -- Find the asset's current price
    SELECT prices.close, prices.tstamp
    FROM api.asset_prices AS prices
    WHERE prices.asset_id = p_asset_id
    ORDER BY prices.tstamp DESC
    LIMIT 1
    INTO price, price_tstamp;

    -- Check if price was found
    IF price IS NULL THEN
        RAISE EXCEPTION 'No price found for asset %', p_asset_id;
    END IF;

    -- Verify that the depot has enough cash
    SELECT dp.worth
    FROM depots.positions AS dp
    WHERE dp.depot_id = p_depot_id AND dp.asset_id = p_asset_id
    INTO possessed_worth;

    -- Check if depot exists
    IF possessed_worth IS NULL THEN
        RAISE EXCEPTION 'No position for depot % on asset % found', p_depot_id, p_asset_id;
    END IF;

    worth_to_sell := LEAST(possessed_worth, p_worth);

    asset_amount := worth_to_sell / price;
    total_profit := worth_to_sell - commission;

    -- add the cash
    UPDATE depots.depots
    SET cash = cash + total_profit
    WHERE id = p_depot_id;

    IF possessed_worth = worth_to_sell THEN
        DELETE FROM depots.positions
        WHERE
            asset_id = p_asset_id AND
            depot_id = p_depot_id;
    ELSE
        UPDATE depots.positions
        SET
            amount = amount - asset_amount,
            worth = worth - worth_to_sell
        WHERE
            asset_id = p_asset_id AND
            depot_id = p_depot_id;
    END IF;


    PERFORM log_transaction (p_asset_id, p_depot_id, - asset_amount, price, commission);
END;
$$ ;

CREATE OR REPLACE FUNCTION depots.get_commission() RETURNS REAL LANGUAGE sql AS $$
    SELECT current_setting('config.commission')::REAL AS result;
$$;

GRANT EXECUTE ON FUNCTION depots.get_commission() TO authenticated;
GRANT EXECUTE ON FUNCTION depots.buy_asset(BIGINT, BIGINT, REAL) TO authenticated;
GRANT EXECUTE ON FUNCTION depots.sell_asset(BIGINT, BIGINT, REAL) TO authenticated;
GRANT EXECUTE ON FUNCTION depots.log_transaction(BIGINT, BIGINT, REAL, REAL, REAL) TO authenticated;
GRANT EXECUTE ON FUNCTION depots.update_depot_positions() TO authenticated;
-- CREATE OR REPLACE MATERIALIZED VIEW depots.values

-- WITH daily_totals AS (
--     SELECT
--         depot_id,
--         asset_id,
--         DATE(tstamp) as date,
--         SUM(amount) as daily_amount,
--         SUM(commission) as daily_commission
--     FROM depots.transactions
--     GROUP BY depot_id, asset_id, DATE(tstamp)
-- ),
-- daily_holdings AS (SELECT
--     depot_id,
--     asset_id,
--     date,
--     daily_amount,
--     daily_commission,
--     SUM(daily_amount) OVER(
--         PARTITION BY depot_id, asset_id
--         ORDER BY date
--     ) as running_amount,
--     SUM(daily_commission) OVER(
--         PARTITION BY depot_id, asset_id
--         ORDER BY date
--     ) as running_commission
-- FROM daily_totals)

CREATE OR REPLACE FUNCTION depots.execute_savings_plans()
RETURNS void AS $$
BEGIN
  WITH executable_plans AS (
    SELECT 
      sp.id,
      sp.depot_id,
      sp.asset_id,
      sp.worth / p.close AS amount,
      p.close AS price
    FROM depots.savings_plans sp
    JOIN depots.depots d ON d.id = sp.depot_id
    JOIN LATERAL (
      SELECT close FROM api.asset_prices
      WHERE asset_id = sp.asset_id
      ORDER BY tstamp DESC
      LIMIT 1
    ) p ON TRUE
    WHERE sp.last_executed + depots.sp_to_interval(sp.period) <= CURRENT_DATE -- only the plans due to update today or before
  ),
  inserted AS (
    INSERT INTO depots.transactions (depot_id, asset_id, amount, price, commission, user_id, type)
    SELECT 
      ep.depot_id,
      ep.asset_id,
      ep.amount,
      ep.price,
      0.0,
      NULL,
      'savings_plan'::TransactionType
    FROM executable_plans ep
    RETURNING depot_id, asset_id
  )
  UPDATE depots.savings_plans sp
  SET last_executed = CURRENT_DATE
  FROM executable_plans ep
  WHERE sp.id = ep.id;
END;
$$ LANGUAGE plpgsql;
