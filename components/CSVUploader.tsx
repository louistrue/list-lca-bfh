'use client'

import { useState } from 'react'
import Papa from 'papaparse'

interface CSVUploaderProps {
  onUpload: (data: string[][], headers: string[]) => void
}

export default function CSVUploader({ onUpload }: CSVUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleFileUpload = (file: File) => {
    Papa.parse(file, {
      complete: (results) => {
        const data = results.data as string[][]
        const headers = data[0]
        // Debug: log first row to check parsing, especially volume column
        if (data.length > 1) {
          console.log('CSV First row sample:', data[1].slice(0, 10))
          // Find GrossVolume column index
          const volumeIdx = headers.findIndex(h => h.toLowerCase().includes('volume'))
          if (volumeIdx >= 0 && data[1][volumeIdx]) {
            console.log(`Volume column (${headers[volumeIdx]}): "${data[1][volumeIdx]}"`)
          }
        }
        onUpload(data.slice(1), headers)
      },
      // Ensure apostrophes are not treated as quote characters
      quoteChar: '"',
      escapeChar: '"',
      // Don't skip empty lines
      skipEmptyLines: false,
      // Handle encoding properly
      encoding: 'UTF-8',
      // Don't transform values - keep them as strings for our normalization
      transform: undefined,
    })
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    handleFileUpload(file)
  }

  return (
    <div
      className={`border-2 border-dashed p-8 text-center ${
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <p className="mb-4">
        Ziehen Sie Ihre CSV-Datei hierher oder klicken Sie, um eine Datei auszuwählen
      </p>
      <input
        type="file"
        accept=".csv"
        onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
        className="hidden"
        id="csv-upload"
      />
      <label
        htmlFor="csv-upload"
        className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded cursor-pointer"
      >
        CSV-Datei auswählen
      </label>
    </div>
  )
}

