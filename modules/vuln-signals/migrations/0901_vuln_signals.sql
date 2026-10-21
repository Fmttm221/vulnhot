-- 每个 CVE 的客观风险信号（modules/vuln-signals）：CVSS 与向量（NVD）、EPSS 与分位（FIRST）、
-- 是否在 CISA KEV 里及其修复截止日。三个来源各自记拉取时间，互不覆盖。
CREATE TABLE IF NOT EXISTS cve_risk_signals (
  cve_id              text PRIMARY KEY,
  cvss                numeric(3,1),
  cvss_vector         text,
  epss                numeric(6,5),
  epss_percentile     numeric(6,5),
  in_kev              boolean NOT NULL DEFAULT false,
  kev_due_date        date,
  nvd_fetched_at      timestamptz,
  epss_fetched_at     timestamptz,
  kev_fetched_at      timestamptz
);
