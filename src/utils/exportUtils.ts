/**
 * Utility to export JSON data to CSV
 * Supports custom headers and nested object paths (simple)
 */
export function exportToCSV(data: any[], fileName: string, headers?: string[]) {
    if (!data || !data.length) return;

    const columnHeaders = headers || Object.keys(data[0]);
    const csvRows = [];

    // Add headers
    csvRows.push(columnHeaders.join(','));

    // Add data rows
    for (const row of data) {
        const values = columnHeaders.map(header => {
            const val = row[header];
            const escaped = ('' + val).replace(/"/g, '""');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function formatAttendanceForExport(logs: any[]) {
    return logs.map(log => ({
        "Employee": log.employee_name,
        "Date": new Date(log.check_in).toLocaleDateString(),
        "Check In": new Date(log.check_in).toLocaleTimeString(),
        "Check Out": log.check_out ? new Date(log.check_out).toLocaleTimeString() : "N/A",
        "Status": log.status,
        "Notes": log.notes || ""
    }));
}

export function formatLeavesForExport(requests: any[]) {
    return requests.map(req => ({
        "Employee": req.employee_name,
        "Type": req.leave_type,
        "Start Date": req.start_date,
        "End Date": req.end_date,
        "Status": req.status,
        "Reason": req.reason || ""
    }));
}
