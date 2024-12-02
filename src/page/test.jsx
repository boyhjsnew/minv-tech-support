import React, { useState } from "react";

function App() {
  const [pdfData, setPdfData] = useState(null);

  // Read JSON file on file selection
  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const fileText = await file.text();
      const jsonData = JSON.parse(fileText);
      if (jsonData.content) {
        // Assume PDF content is in JSON 'content' field
        setPdfData(jsonData.content);
        console.log(jsonData.content);
      }
    }
  };

  // Display PDF in new window or iframe
  const displayPdf = () => {
    const pdfBlob = new Blob([pdfData], { type: "application/pdf" });
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl);
  };

  return (
    <div>
      <input
        type="file"
        onChange={handleFileChange}
        accept=".json"
        style={{ paddingTop: "100px" }}
      />
      {pdfData && <button onClick={displayPdf}>View PDF</button>}
    </div>
  );
}

export default App;
