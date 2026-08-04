/**
 * DocExporter - Generates formatted Microsoft Word (.docx) and PDF (.pdf) documents
 * for meeting minutes, summaries, action items, and transcripts.
 */

class DocExporter {
  /**
   * Generates a Microsoft Word (.docx) blob from meeting object
   */
  static async generateWordDoc(meeting) {
    if (!window.docx) {
      throw new Error("docx.js library is not loaded.");
    }

    const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } = window.docx;

    const title = meeting.title || "Meeting Summary";
    const dateStr = meeting.created_at ? new Date(meeting.created_at).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    }) : new Date().toLocaleDateString();
    const durationMins = Math.round((meeting.duration_seconds || 0) / 60);

    const docChildren = [
      // Main Document Title
      new Paragraph({
        text: title,
        heading: HeadingLevel.TITLE,
        spacing: { after: 120 },
      }),

      // Metadata Bar
      new Paragraph({
        children: [
          new TextRun({ text: `Date: `, bold: true }),
          new TextRun({ text: `${dateStr}   |   ` }),
          new TextRun({ text: `Duration: `, bold: true }),
          new TextRun({ text: `${durationMins} minutes   |   ` }),
          new TextRun({ text: `Source: `, bold: true }),
          new TextRun({ text: `${(meeting.source || 'speaker_mic').replace('_', ' ').toUpperCase()}` }),
        ],
        spacing: { after: 300 },
      }),

      // Executive Summary Section
      new Paragraph({
        text: "Executive Summary",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 120 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: meeting.summary || "No executive summary available.", size: 24 })
        ],
        spacing: { after: 300 },
      }),
    ];

    // Key Takeaways Section
    if (meeting.key_takeaways && Array.isArray(meeting.key_takeaways) && meeting.key_takeaways.length > 0) {
      docChildren.push(
        new Paragraph({
          text: "Key Takeaways & Decisions",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 200, after: 120 },
        })
      );

      meeting.key_takeaways.forEach(takeaway => {
        docChildren.push(
          new Paragraph({
            text: `• ${takeaway}`,
            bullet: { level: 0 },
            spacing: { after: 80 },
          })
        );
      });

      docChildren.push(new Paragraph({ text: "", spacing: { after: 200 } }));
    }

    // Action Items Table
    if (meeting.action_points && Array.isArray(meeting.action_points) && meeting.action_points.length > 0) {
      docChildren.push(
        new Paragraph({
          text: "Action Items & Deliverables",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 200, after: 120 },
        })
      );

      const tableRows = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Action Item", bold: true, color: "FFFFFF" })] })], shading: { fill: "4338CA" } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Assignee", bold: true, color: "FFFFFF" })] })], shading: { fill: "4338CA" } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Due Date", bold: true, color: "FFFFFF" })] })], shading: { fill: "4338CA" } }),
          ],
        }),
      ];

      meeting.action_points.forEach(ap => {
        tableRows.push(
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ text: ap.task || ap })] }),
              new TableCell({ children: [new Paragraph({ text: ap.assignee || "Unassigned" })] }),
              new TableCell({ children: [new Paragraph({ text: ap.due_date || "TBD" })] }),
            ],
          })
        );
      });

      const actionTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows,
      });

      docChildren.push(actionTable);
      docChildren.push(new Paragraph({ text: "", spacing: { after: 300 } }));
    }

    // Full Transcript Section
    if (meeting.raw_transcript) {
      docChildren.push(
        new Paragraph({
          text: "Full Transcript",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 200, after: 120 },
        })
      );

      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: meeting.raw_transcript, size: 20, color: "475569" })
          ],
          spacing: { after: 200 },
        })
      );
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children: docChildren,
      }],
    });

    const blob = await Packer.toBlob(doc);
    return blob;
  }

  /**
   * Generates a PDF blob from meeting object using jsPDF or html2pdf
   */
  static async generatePdfDoc(meeting) {
    if (!window.jspdf) {
      throw new Error("jsPDF library is not loaded.");
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 40;

    // Header Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(30, 27, 75); // Indigo dark
    doc.text(meeting.title || "Meeting Summary", 40, y);
    y += 24;

    // Subtitle / Date
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    const dateStr = meeting.created_at ? new Date(meeting.created_at).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    }) : new Date().toLocaleDateString();
    const durationMins = Math.round((meeting.duration_seconds || 0) / 60);
    doc.text(`Date: ${dateStr}   |   Duration: ${durationMins} mins   |   Source: ${(meeting.source || 'speaker_mic').toUpperCase()}`, 40, y);
    y += 20;

    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(1.5);
    doc.line(40, y, pageWidth - 40, y);
    y += 24;

    // Executive Summary
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(67, 56, 202);
    doc.text("Executive Summary", 40, y);
    y += 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    const summaryLines = doc.splitTextToSize(meeting.summary || "No executive summary available.", pageWidth - 80);
    doc.text(summaryLines, 40, y);
    y += summaryLines.length * 14 + 20;

    // Key Takeaways
    if (meeting.key_takeaways && Array.isArray(meeting.key_takeaways) && meeting.key_takeaways.length > 0) {
      if (y > 750) { doc.addPage(); y = 40; }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(67, 56, 202);
      doc.text("Key Takeaways", 40, y);
      y += 18;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);

      meeting.key_takeaways.forEach(kt => {
        const ktLines = doc.splitTextToSize(`• ${kt}`, pageWidth - 90);
        doc.text(ktLines, 50, y);
        y += ktLines.length * 14 + 4;
      });
      y += 16;
    }

    // Action Items
    if (meeting.action_points && Array.isArray(meeting.action_points) && meeting.action_points.length > 0) {
      if (y > 700) { doc.addPage(); y = 40; }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(67, 56, 202);
      doc.text("Action Items", 40, y);
      y += 18;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setFillColor(241, 245, 249);
      doc.rect(40, y, pageWidth - 80, 20, "F");
      doc.setTextColor(71, 85, 105);
      doc.text("Task", 50, y + 14);
      doc.text("Assignee", 320, y + 14);
      doc.text("Due Date", 450, y + 14);
      y += 24;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);

      meeting.action_points.forEach(ap => {
        if (y > 780) { doc.addPage(); y = 40; }
        const taskText = doc.splitTextToSize(ap.task || ap, 260);
        doc.text(taskText, 50, y);
        doc.text(ap.assignee || "Unassigned", 320, y);
        doc.text(ap.due_date || "TBD", 450, y);
        y += Math.max(taskText.length * 14, 18);
      });
      y += 20;
    }

    // Transcript
    if (meeting.raw_transcript) {
      if (y > 700) { doc.addPage(); y = 40; }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(67, 56, 202);
      doc.text("Full Transcript", 40, y);
      y += 18;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);

      const transcriptLines = doc.splitTextToSize(meeting.raw_transcript, pageWidth - 80);
      for (let i = 0; i < transcriptLines.length; i++) {
        if (y > 780) {
          doc.addPage();
          y = 40;
        }
        doc.text(transcriptLines[i], 40, y);
        y += 12;
      }
    }

    const pdfBlob = doc.output("blob");
    return pdfBlob;
  }

  /**
   * Helper to trigger download of Blob in browser
   */
  static downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Helper to convert Blob to Base64 string for API attachments
   */
  static async blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

window.DocExporter = DocExporter;
