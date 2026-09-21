CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  era TEXT NOT NULL,
  summary TEXT NOT NULL,
  identity TEXT NOT NULL,
  world TEXT NOT NULL,
  cards TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE INDEX campaigns_version_created ON campaigns(version, created DESC);
CREATE VIRTUAL TABLE campaign_search USING fts5(id UNINDEXED, description, tokenize='unicode61');
