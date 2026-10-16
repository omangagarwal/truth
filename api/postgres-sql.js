export function compileD1Sql(sql) {
  let parameter = 0;
  return sql
    .replace(/date\('now',\s*'-(\d+)\s+days?'\)/gi, "to_char(CURRENT_DATE - INTERVAL '$1 days', 'YYYY-MM-DD')")
    .replace(/\?/g, () => `$${++parameter}`);
}
