import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function ImportCSVDialog({ open, onOpenChange }) {
  const { state, dispatch } = useApp();
  
  const [file, setFile] = useState(null);
  const [step, setStep] = useState(1); // 1: Upload, 2: Mapping
  const [preview, setPreview] = useState([]);
  const [mapping, setMapping] = useState({
    firstName: "0",
    lastName: "1",
    company: "2",
    email: "3",
    phone: "4"
  });

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Simulate reading CSV
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const lines = text.split("\n").map(line => line.split(",").map(cell => cell.trim()));
        setPreview(lines.slice(0, 4)); // Header + 3 rows
        setStep(2);
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleImport = () => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split("\n").map(line => line.split(",").map(cell => cell.trim())).filter(l => l.length > 1);
      
      const newContacts = lines.slice(1).map((line, idx) => ({
        id: "c-import-" + Date.now() + idx,
        createdBy: state.currentUser.id,
        firstName: line[parseInt(mapping.firstName)] || "",
        lastName: line[parseInt(mapping.lastName)] || "",
        company: line[parseInt(mapping.company)] || "",
        email: line[parseInt(mapping.email)] || "",
        phone: line[parseInt(mapping.phone)] || "",
        tags: ["prospect"],
        notes: "Importé via CSV",
        interactions: [],
        createdAt: new Date().toISOString()
      }));

      // Filter duplicates by email
      const existingEmails = new Set(state.contacts.map(c => c.email.toLowerCase()));
      const uniqueNewContacts = newContacts.filter(c => !existingEmails.has(c.email.toLowerCase()));
      
      dispatch({ type: "UPDATE_CONTACTS", payload: [...state.contacts, ...uniqueNewContacts] });
      toast.success(`${uniqueNewContacts.length} contacts importés (${newContacts.length - uniqueNewContacts.length} doublons ignorés)`);
      onOpenChange(false);
      reset();
    };
    reader.readAsText(file);
  };

  const reset = () => {
    setFile(null);
    setStep(1);
    setPreview([]);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { onOpenChange(val); if(!val) reset(); }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Importer des contacts (CSV)</DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="py-8 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative">
            <input 
              type="file" 
              accept=".csv" 
              className="absolute inset-0 opacity-0 cursor-pointer" 
              onChange={handleFileChange}
            />
            <Upload className="w-12 h-12 text-slate-300 mb-4" />
            <p className="text-slate-600 font-medium">Cliquez ou glissez un fichier .csv</p>
            <p className="text-slate-400 text-sm mt-1">Séparateur virgule (,) recommandé</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-blue-50 p-3 rounded-lg flex items-start gap-3 border border-blue-100">
              <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
              <p className="text-xs text-blue-700 leading-relaxed">
                Vérifiez le mapping des colonnes ci-dessous. Nous avons détecté {preview[0]?.length} colonnes dans votre fichier.
              </p>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    {preview[0]?.map((col, idx) => (
                      <TableHead key={idx} className="text-[10px] font-bold uppercase py-2 h-auto">{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.slice(1).map((row, rIdx) => (
                    <TableRow key={rIdx}>
                      {row.map((cell, cIdx) => (
                        <TableCell key={cIdx} className="text-xs py-2">{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {Object.keys(mapping).map((field) => (
                <div key={field} className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">{field}</Label>
                  <Select value={mapping[field]} onValueChange={(val) => setMapping({...mapping, [field]: val})}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {preview[0]?.map((col, idx) => (
                        <SelectItem key={idx} value={idx.toString()}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          {step === 2 && (
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleImport}>
              <Check className="w-4 h-4 mr-2" />
              Importer les contacts
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
