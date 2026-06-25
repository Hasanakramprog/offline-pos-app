// Thin wrappers around window.electronAPI.database
export const db = {
  query: <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> =>
    window.electronAPI.database.query(sql, params) as Promise<T[]>,

  run: (sql: string, params: unknown[] = []) =>
    window.electronAPI.database.run(sql, params),

  exec: (sql: string) => window.electronAPI.database.exec(sql),
};
