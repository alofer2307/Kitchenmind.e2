import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function DataTable({ headers, rows, emptyMessage = "No hay registros para mostrar." }: { headers: string[]; rows: Array<Array<string | number | React.ReactNode>>; emptyMessage?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#dbe7f2] bg-white">
      <div className="overflow-x-auto">
        <Table className="min-w-[680px]">
          <TableHeader><TableRow className="bg-[#f6f9fc] hover:bg-[#f6f9fc]">{headers.map((header) => <TableHead key={header} className="h-12 px-4 text-sm font-bold text-[#60758b]">{header}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {rows.length ? rows.map((row, rowIndex) => <TableRow key={rowIndex}>{row.map((cell, cellIndex) => <TableCell key={cellIndex} className="px-4 py-4 text-sm text-[#314b65]">{cell}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={headers.length} className="h-28 text-center text-[#718398]">{emptyMessage}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
