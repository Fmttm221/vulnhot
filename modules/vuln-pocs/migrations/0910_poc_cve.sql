-- PoC 索引（modules/vuln-pocs）：重建自 pocindex 的公开索引，一个 CVE 一行。
-- 这里只存索引自己的东西（编号、描述、日期、各类利用条目的数量）；CVSS/EPSS/KEV 由 vuln-signals 抓，
-- 那三样不在两张表里各存一份。
CREATE TABLE IF NOT EXISTS poc_cve (
  cve_id           text PRIMARY KEY,
  description      text,
  published        date,
  modified         timestamptz,
  poc_count        int NOT NULL DEFAULT 0,
  nuclei_count     int NOT NULL DEFAULT 0,
  msf_count        int NOT NULL DEFAULT 0,
  edb_count        int NOT NULL DEFAULT 0,
  vulhub_count     int NOT NULL DEFAULT 0,
  collection_count int NOT NULL DEFAULT 0,
  synced_at        timestamptz NOT NULL DEFAULT now()
);
