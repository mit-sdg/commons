"use client";

import { Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api, publicErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface CsvRow {
  [key: string]: string;
}

interface CsvImportProps {
  onComplete: () => void;
}

export function CsvImport({ onComplete }: CsvImportProps) {
  const { session } = useAuth();
  const [csv, setCsv] = useState("");
  const [rows, setRows] = useState<CsvRow[] | null>(null);
  const [previewSource, setPreviewSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const hasSectionErrors = rows?.some((row) => row.sectionError) ?? false;

  async function preview() {
    if (!csv.trim()) return;
    setLoading(true);
    const result = await api.roster["import-preview"]({
      csv: csv.trim(),
    });
    setLoading(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      setRows(result.rows ?? []);
      setPreviewSource(csv.trim());
    }
  }

  async function doImport() {
    if (!session || !rows || rows.length === 0) return;
    setImporting(true);
    const result = await api.roster.import({ rows });
    setImporting(false);
    if ("error" in result) {
      toast.error(publicErrorMessage(result.error));
      return;
    }
    const created = result.created?.length ?? 0;
    const skipped = result.skipped?.length ?? 0;
    const people = `${created} ${created === 1 ? "person" : "people"}`;
    toast.success(
      skipped === 0
        ? `Added ${people}`
        : `Added ${people}; skipped ${skipped} existing ${skipped === 1 ? "seat" : "seats"}`,
    );
    onComplete();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="roster-csv">Paste CSV (with header row)</Label>
        <p className="text-sm text-muted-foreground">
          Existing accounts are enrolled. Everyone else gets an email
          invitation. Existing seats are skipped.
        </p>
        <p className="text-sm text-muted-foreground">
          Optional fourth column: <span className="font-mono">displayName</span>
          . It prefills registration. For names with commas, use the form above.
        </p>
        <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 px-3 py-2 text-xs font-mono leading-relaxed text-muted-foreground">
          {
            "email,kind,section,displayName\njdoe@school.edu,STUDENT,Section 01,Jamie Doe"
          }
        </pre>
        <a
          className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          download="commons-roster-template.csv"
          href="data:text/csv;charset=utf-8,email%2Ckind%2Csection%2CdisplayName%0Astudent%40school.edu%2CSTUDENT%2CSection%2001%2CJamie%20Doe"
        >
          Download CSV template
        </a>
        <Textarea
          id="roster-csv"
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setRows(null);
            setPreviewSource("");
          }}
          placeholder="Paste the rows here"
          rows={6}
          spellCheck={false}
          className="font-mono text-sm whitespace-pre-wrap break-words"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={preview}
          disabled={loading || !csv.trim()}
        >
          {loading ? "Parsing..." : "Preview"}
        </Button>
      </div>

      {rows !== null && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">
              {rows.length} {rows.length === 1 ? "row" : "rows"} parsed
            </p>
            {hasSectionErrors ? (
              <p className="text-sm text-destructive">
                Fix unknown or ambiguous section names, then preview again.
              </p>
            ) : null}
            <Button
              size="sm"
              onClick={doImport}
              disabled={
                importing ||
                rows.length === 0 ||
                previewSource !== csv.trim() ||
                hasSectionErrors
              }
            >
              <Upload className="size-4 mr-1" />
              {importing
                ? "Importing..."
                : `Import ${rows.length} ${rows.length === 1 ? "seat" : "seats"}`}
            </Button>
          </div>
          <div className="max-h-64 overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  {Object.keys(rows[0] ?? {}).map((key) => (
                    <TableHead key={key} className="text-xs">
                      {key}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={Object.values(row).join("|")}>
                    {Object.entries(row).map(([key, value]) => (
                      <TableCell key={key} className="text-xs font-mono">
                        {value}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
