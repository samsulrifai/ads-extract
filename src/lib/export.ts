export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((fieldName) => {
          let value = row[fieldName];
          // Handle null/undefined
          if (value === null || value === undefined) {
            value = '';
          } else if (typeof value === 'object') {
            value = JSON.stringify(value);
          } else {
            value = String(value);
          }
          // Escape quotes and wrap in quotes if contains comma
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            value = `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if ((window.navigator as any).msSaveBlob) { // IE 10+
    (window.navigator as any).msSaveBlob(blob, filename);
  } else {
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.style.visibility = 'hidden';
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
