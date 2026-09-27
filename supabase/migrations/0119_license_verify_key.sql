-- =====================================================================
-- Migration 0119 : The key this computer signs its printed documents with
--
-- Delivered by the codes server with the license. A printed invoice,
-- quotation or order carries a QR with the document's facts signed with it;
-- anyone can scan it and the codes server's /verify page says whether the
-- facts are the company's. Signing needs no internet. Local to the computer.
-- =====================================================================

alter table _spir_license add column if not exists verify_key text not null default '';
