import os
import re
import sys

AUDIT_PATH = os.path.join(os.path.dirname(__file__), "..", "audits", "documentation_gap_audit.md")

def parse_table_rows(table_lines):
    header_line = table_lines[0]
    headers = [c.strip() for c in header_line.strip("|").split("|")]
    rows = []
    for line in table_lines[2:]:
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) == len(headers):
            row_dict = {headers[i]: cells[i] for i in range(len(headers))}
            rows.append(row_dict)
    return headers, rows

def clean_num(val_str):
    clean = re.sub(r"[^\d]", "", val_str)
    return int(clean) if clean else 0

def normalize_doc_path(doc_ref):
    m = re.search(r"`([^`]+)`", doc_ref)
    if m:
        return m.group(1).strip()
    return doc_ref.split("§")[0].strip()

def normalize_category(cat_str):
    c = cat_str.strip().replace("`", "")
    if "Outdated" in c or "Contradictory" in c:
        return "Outdated / Contradictory"
    elif "Missing" in c:
        return "Missing Information"
    elif "Unstated" in c:
        return "Unstated Assumption"
    elif "Ambiguous" in c:
        return "Ambiguous Step"
    elif "Unguided" in c:
        return "Unguided Error Scenario"
    return c

def main():
    sys.stdout.reconfigure(encoding="utf-8")
    if not os.path.exists(AUDIT_PATH):
        print(f"ERROR: File not found: {AUDIT_PATH}")
        sys.exit(1)

    with open(AUDIT_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    lines = content.splitlines()
    print("================================================================================")
    print("EMPIRICAL TEST SUITE: DOCUMENTATION GAP AUDIT STRUCTURAL & MATHEMATICAL INTEGRITY")
    print("================================================================================\n")

    # 1. Finding Extraction & Sequential ID Integrity
    print("[TEST 1] Finding Extraction & Sequential ID Integrity")
    heading_pattern = re.compile(r"^#### `\[([A-Z]+-\d+)\]\s+(.+)`$")
    findings = []
    current = None

    for idx, line in enumerate(lines, 1):
        m = heading_pattern.match(line.strip())
        if m:
            if current:
                findings.append(current)
            current = {
                "id": m.group(1),
                "title": m.group(2),
                "start_line": idx,
                "lines": []
            }
        elif current:
            if line.startswith("## ") or line.startswith("### "):
                findings.append(current)
                current = None
            else:
                current["lines"].append(line)
    if current:
        findings.append(current)

    print(f"  -> Total finding cards extracted: {len(findings)}")
    assert len(findings) == 86, f"Expected 86 findings, found {len(findings)}"

    blockers = [f for f in findings if f["id"].startswith("BLOCKER-")]
    slows = [f for f in findings if f["id"].startswith("SLOW-")]
    minors = [f for f in findings if f["id"].startswith("MINOR-")]

    assert len(blockers) == 21, f"Expected 21 Blockers, got {len(blockers)}"
    assert len(slows) == 43, f"Expected 43 Slowdowns, got {len(slows)}"
    assert len(minors) == 22, f"Expected 22 Minors, got {len(minors)}"

    expected_blocker_ids = [f"BLOCKER-{i:02d}" for i in range(1, 22)]
    expected_slow_ids = [f"SLOW-{i:02d}" for i in range(1, 44)]
    expected_minor_ids = [f"MINOR-{i:02d}" for i in range(1, 23)]

    assert [f["id"] for f in blockers] == expected_blocker_ids, "BLOCKER ID sequence mismatch"
    assert [f["id"] for f in slows] == expected_slow_ids, "SLOW ID sequence mismatch"
    assert [f["id"] for f in minors] == expected_minor_ids, "MINOR ID sequence mismatch"
    print("  -> PASSED: All 86 IDs are unique and strictly sequential ([BLOCKER-01]..[BLOCKER-21], [SLOW-01]..[SLOW-43], [MINOR-01]..[MINOR-22]).\n")

    # 2. Schema Integrity for Finding Cards
    print("[TEST 2] Schema Integrity for Finding Cards")
    valid_categories = {
        "Missing Information",
        "Unstated Assumption",
        "Ambiguous Step",
        "Unguided Error Scenario",
        "Outdated / Contradictory"
    }

    cards_by_doc = {}
    cards_by_cat = {cat: {"BLOCKER": 0, "SLOW": 0, "MINOR": 0, "Total": 0} for cat in valid_categories}

    for f in findings:
        text_block = "\n".join(f["lines"])
        sev = f["id"].split("-")[0]

        # Field 1: Document & Section Reference
        m_doc = re.search(r"-\s+\*\*(?:Document & Section|Document & Section Reference)\*\*:\s*(.+)", text_block)
        assert m_doc, f"Finding {f['id']} missing Document & Section Reference"
        doc_ref = m_doc.group(1).strip()
        doc_path = normalize_doc_path(doc_ref)
        assert doc_path, f"Finding {f['id']} has empty doc path"
        f["doc_path"] = doc_path
        f["doc_ref"] = doc_ref

        # Field 2: Gap Category
        m_cat = re.search(r"-\s+\*\*Gap Category\*\*:\s*(.+)", text_block)
        assert m_cat, f"Finding {f['id']} missing Gap Category"
        cat_norm = normalize_category(m_cat.group(1).strip())
        assert cat_norm in valid_categories, f"Finding {f['id']} has invalid category '{cat_norm}'"
        f["gap_category"] = cat_norm

        # Field 3: Impact Description
        m_imp = re.search(r"-\s+\*\*(?:Impact|Impact Description)\*\*:\s*(.+)", text_block)
        assert m_imp and len(m_imp.group(1).strip()) > 10, f"Finding {f['id']} missing valid Impact Description"
        f["impact"] = m_imp.group(1).strip()

        # Field 4: One-Sentence Fix Note
        m_fix = re.search(r"-\s+\*\*(?:1-Sentence Fix Note|One-Sentence Fix Note|Fix Note)\*\*:\s*(.+)", text_block)
        assert m_fix and len(m_fix.group(1).strip()) > 10, f"Finding {f['id']} missing valid One-Sentence Fix Note"
        f["fix_note"] = m_fix.group(1).strip()

        # Tally
        if doc_path not in cards_by_doc:
            cards_by_doc[doc_path] = {"BLOCKER": 0, "SLOW": 0, "MINOR": 0, "Total": 0}
        cards_by_doc[doc_path][sev] += 1
        cards_by_doc[doc_path]["Total"] += 1

        cards_by_cat[cat_norm][sev] += 1
        cards_by_cat[cat_norm]["Total"] += 1

    print(f"  -> PASSED: All 86 finding cards conform strictly to the required schema.\n")

    # Extract all markdown tables
    all_tables = []
    cur_t = []
    for l in lines:
        if "|" in l:
            cur_t.append(l.strip())
        else:
            if cur_t and len(cur_t) >= 3:
                all_tables.append(cur_t)
            cur_t = []
    if cur_t and len(cur_t) >= 3:
        all_tables.append(cur_t)

    assert len(all_tables) == 3, f"Expected 3 markdown tables in document, found {len(all_tables)}"

    # 3. Table 1.2: Severity Tier vs Document Category Matrix Validation
    print("[TEST 3] Table 1.2: Severity Tier vs Document Category Matrix Validation")
    headers_t1, rows_t1 = parse_table_rows(all_tables[0])
    
    t1_calculated_b = 0
    t1_calculated_s = 0
    t1_calculated_m = 0
    t1_calculated_tot = 0

    for r in rows_t1:
        cat_name = r[headers_t1[0]]
        b_val = clean_num(r[headers_t1[2]])
        s_val = clean_num(r[headers_t1[3]])
        m_val = clean_num(r[headers_t1[4]])
        tot_val = clean_num(r[headers_t1[5]])

        if "Total" in cat_name:
            assert b_val == t1_calculated_b == 21, f"Table 1.2 Total Blockers mismatch: {b_val} vs {t1_calculated_b}"
            assert s_val == t1_calculated_s == 43, f"Table 1.2 Total Slowdowns mismatch: {s_val} vs {t1_calculated_s}"
            assert m_val == t1_calculated_m == 22, f"Table 1.2 Total Minors mismatch: {m_val} vs {t1_calculated_m}"
            assert tot_val == t1_calculated_tot == 86, f"Table 1.2 Grand Total mismatch: {tot_val} vs {t1_calculated_tot}"
            print(f"  -> Total row matches column sums: B={b_val}, S={s_val}, M={m_val}, Total={tot_val}")
        else:
            assert b_val + s_val + m_val == tot_val, f"Table 1.2 Row '{cat_name}' sum mismatch: {b_val}+{s_val}+{m_val} != {tot_val}"
            t1_calculated_b += b_val
            t1_calculated_s += s_val
            t1_calculated_m += m_val
            t1_calculated_tot += tot_val
            print(f"  -> Row '{cat_name[:35]}...': B={b_val}, S={s_val}, M={m_val} -> Row Sum = {tot_val} [PASS]")

    print("  -> PASSED: Table 1.2 is 100% mathematically consistent.\n")

    # 4. Table 1.3: Severity Tier vs Gap Dimension Matrix Validation
    print("[TEST 4] Table 1.3: Severity Tier vs Gap Dimension Matrix Validation")
    headers_t2, rows_t2 = parse_table_rows(all_tables[1])

    t2_calculated_b = 0
    t2_calculated_s = 0
    t2_calculated_m = 0
    t2_calculated_tot = 0

    for r in rows_t2:
        dim_name = normalize_category(r[headers_t2[0]])
        b_val = clean_num(r[headers_t2[1]])
        s_val = clean_num(r[headers_t2[2]])
        m_val = clean_num(r[headers_t2[3]])
        tot_val = clean_num(r[headers_t2[4]])

        if "Total" in r[headers_t2[0]]:
            assert b_val == t2_calculated_b == 21, f"Table 1.3 Total Blockers mismatch: {b_val} vs {t2_calculated_b}"
            assert s_val == t2_calculated_s == 43, f"Table 1.3 Total Slowdowns mismatch: {s_val} vs {t2_calculated_s}"
            assert m_val == t2_calculated_m == 22, f"Table 1.3 Total Minors mismatch: {m_val} vs {t2_calculated_m}"
            assert tot_val == t2_calculated_tot == 86, f"Table 1.3 Grand Total mismatch: {tot_val} vs {t2_calculated_tot}"
            print(f"  -> Total row matches column sums: B={b_val}, S={s_val}, M={m_val}, Total={tot_val}")
        else:
            assert b_val + s_val + m_val == tot_val, f"Table 1.3 Row '{dim_name}' sum mismatch: {b_val}+{s_val}+{m_val} != {tot_val}"
            card_counts = cards_by_cat[dim_name]
            assert b_val == card_counts["BLOCKER"], f"Mismatch in {dim_name} Blockers: table={b_val}, cards={card_counts['BLOCKER']}"
            assert s_val == card_counts["SLOW"], f"Mismatch in {dim_name} Slowdowns: table={s_val}, cards={card_counts['SLOW']}"
            assert m_val == card_counts["MINOR"], f"Mismatch in {dim_name} Minors: table={m_val}, cards={card_counts['MINOR']}"
            assert tot_val == card_counts["Total"], f"Mismatch in {dim_name} Total: table={tot_val}, cards={card_counts['Total']}"

            t2_calculated_b += b_val
            t2_calculated_s += s_val
            t2_calculated_m += m_val
            t2_calculated_tot += tot_val
            print(f"  -> Dimension '{dim_name}': B={b_val}, S={s_val}, M={m_val} -> Total = {tot_val} (Matches finding cards) [PASS]")

    print("  -> PASSED: Table 1.3 is 100% mathematically consistent and matches finding cards.\n")

    # 5. Table 4: Target Document Summary Table Validation
    print("[TEST 5] Table 4: Target Document Summary Table Validation")
    headers_t3, rows_t3 = parse_table_rows(all_tables[2])

    t3_calculated_b = 0
    t3_calculated_s = 0
    t3_calculated_m = 0
    t3_calculated_tot = 0
    doc_count = 0

    for r in rows_t3:
        num_str = r[headers_t3[0]]
        doc_raw = r[headers_t3[1]]
        b_val = clean_num(r[headers_t3[2]])
        s_val = clean_num(r[headers_t3[3]])
        m_val = clean_num(r[headers_t3[4]])
        tot_val = clean_num(r[headers_t3[5]])

        if "TOTALS" in doc_raw:
            assert b_val == t3_calculated_b == 21, f"Table 4 Total Blockers mismatch: {b_val} vs {t3_calculated_b}"
            assert s_val == t3_calculated_s == 43, f"Table 4 Total Slowdowns mismatch: {s_val} vs {t3_calculated_s}"
            assert m_val == t3_calculated_m == 22, f"Table 4 Total Minors mismatch: {m_val} vs {t3_calculated_m}"
            assert tot_val == t3_calculated_tot == 86, f"Table 4 Grand Total mismatch: {tot_val} vs {t3_calculated_tot}"
            assert doc_count == 23, f"Expected 23 audited documents, counted {doc_count}"
            print(f"  -> TOTALS row matches column sums: B={b_val}, S={s_val}, M={m_val}, Grand Total={tot_val} across {doc_count} documents.")
        else:
            doc_count += 1
            doc_p = normalize_doc_path(doc_raw)
            assert b_val + s_val + m_val == tot_val, f"Table 4 row '{doc_p}' sum mismatch: {b_val}+{s_val}+{m_val} != {tot_val}"
            
            card_counts = cards_by_doc.get(doc_p, {"BLOCKER": 0, "SLOW": 0, "MINOR": 0, "Total": 0})
            assert b_val == card_counts["BLOCKER"], f"Doc '{doc_p}' Blocker count mismatch: table={b_val}, cards={card_counts['BLOCKER']}"
            assert s_val == card_counts["SLOW"], f"Doc '{doc_p}' Slowdown count mismatch: table={s_val}, cards={card_counts['SLOW']}"
            assert m_val == card_counts["MINOR"], f"Doc '{doc_p}' Minor count mismatch: table={m_val}, cards={card_counts['MINOR']}"
            assert tot_val == card_counts["Total"], f"Doc '{doc_p}' Total count mismatch: table={tot_val}, cards={card_counts['Total']}"

            t3_calculated_b += b_val
            t3_calculated_s += s_val
            t3_calculated_m += m_val
            t3_calculated_tot += tot_val
            print(f"  -> Doc #{num_str:2s} `{doc_p}`: B={b_val}, S={s_val}, M={m_val} -> Tot={tot_val} [PASS]")

    print("  -> PASSED: Table 4 is 100% mathematically consistent and matches finding cards across all 23 documents.\n")

    # 6. Target Document Coverage & Existence Verification
    print("[TEST 6] Target Document Coverage & Existence Verification")
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    missing_files = []
    for doc_p in cards_by_doc.keys():
        full_p = os.path.join(repo_root, doc_p.replace("/", os.sep))
        exists = os.path.exists(full_p)
        if not exists:
            missing_files.append((doc_p, full_p))
        print(f"  - Target doc `{doc_p}` exists on filesystem: {'YES' if exists else 'NO'}")

    assert len(missing_files) == 0, f"Some audited target documents do not exist: {missing_files}"
    print("  -> PASSED: All 23 target documents exist on filesystem and were audited.\n")

    print("================================================================================")
    print("ALL EMPIRICAL TESTS PASSED WITH 100% MATHEMATICAL & STRUCTURAL PRECISION")
    print("================================================================================")

if __name__ == "__main__":
    main()
