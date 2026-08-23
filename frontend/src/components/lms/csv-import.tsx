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
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  async function preview() {
    if (!csv.trim()) return;
    setLoading(true);
    const result = await api.roster["import-preview"]({
      csv: csv.trim(),
    });
    setLoading(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else setRows(result.rows ?? []);
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
        ? `Invited ${people}`
        : `Invited ${people}; ${skipped} already had a seat`,
    );
    onComplete();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="roster-csv">Paste CSV (with header row)</Label>
        <p className="text-sm text-muted-foreground">
          Each address is invited by email. Accepting the invitation creates the
          account and takes the seat, so nothing has to be enrolled by hand. An
          address that already has a seat is skipped rather than invited again.
        </p>
        <pre className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs font-mono leading-relaxed text-muted-foreground">
          email,kind,section{"\n"}jdoe@school.edu,STUDENT,sec01
        </pre>
        <Textarea
          id="roster-csv"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder="Paste the rows here"
          rows={6}
          className="font-mono text-sm"
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
            <Button
              size="sm"
              onClick={doImport}
              disabled={importing || rows.length === 0}
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
