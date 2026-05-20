import React, { useState, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { db } from "@/lib/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Check, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const CONTACT_FIELDS = [
  { id: "firstName", label: "Prénom" },
  { id: "lastName", label: "Nom" },
  { id: "company", label: "Entreprise" },
  { id: "siret", label: "SIRET" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Téléphone" },
  { id: "industry", label: "Secteur / Industrie" },
  { id: "notes", label: "Notes / Commentaires" }
];

export default function ImportContactsDialog({ open, onOpenChange, activeListId }) {
  const { state, dispatch } = useApp();
  
  const [file, setFile] = useState(null);
  const [step, setStep] = useState(1); // 1: Upload, 2: Mapping
  const [preview, setPreview] = useState([]);
  const [fullData, setFullData] = useState([]);
  const [mapping, setMapping] = useState({});
  const [isImporting, setIsImporting] = useState(false);
  const [targetListId, setTargetListId] = useState(activeListId || "list-default");

  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const bstr = event.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        if (data.length === 0) {
          toast.error("Le fichier est vide");
          return;
        }

        setFullData(data);
        setPreview(data.slice(0, 5)); // Header + 4 rows
        
        // Auto-mapping attempt
        const headers = data[0];
        const initialMapping = {};
        CONTACT_FIELDS.forEach(field => {
          const match = headers.findIndex(h => 
            h?.toString().toLowerCase().includes(field.label.toLowerCase()) || 
            h?.toString().toLowerCase().includes(field.id.toLowerCase())
          );
          if (match !== -1) initialMapping[field.id] = match.toString();
        });
        setMapping(initialMapping);
        
        setStep(2);
      } catch (error) {
        console.error("Error reading file:", error);
        toast.error("Erreur lors de la lecture du fichier");
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleImport = async () => {
    if (!mapping.firstName || !mapping.lastName || !mapping.email) {
      toast.error("Veuillez mapper au moins le Prénom, le Nom et l'Email");
      return;
    }

    setIsImporting(true);
    try {
      const headers = fullData[0];
      const rows = fullData.slice(1);
      
      const newContacts = rows.filter(row => row.length > 0).map((row) => {
        const contact = {
          createdBy: state.currentUser.id,
          listId: targetListId,
          firstName: row[parseInt(mapping.firstName)] || "",
          lastName: row[parseInt(mapping.lastName)] || "",
          company: row[parseInt(mapping.company)] || "",
          siret: row[parseInt(mapping.siret)] || "",
          email: row[parseInt(mapping.email)] || "",
          phone: row[parseInt(mapping.phone)] || "",
          industry: row[parseInt(mapping.industry)] || "",
          notes: row[parseInt(mapping.notes)] || "Importé le " + new Date().toLocaleDateString(),
          tags: ["prospect"],
          interactions: [],
          lastModified: new Date().toISOString()
        };
        return contact;
      });

      // Simple email validation filter
      const validContacts = newContacts.filter(c => c.email && c.email.includes("@"));
      
      if (validContacts.length === 0) {
        toast.error("Aucun contact valide trouvé");
        setIsImporting(false);
        return;
      }

      const savedContacts = await db.bulkInsertContacts(validContacts);
      
      dispatch({ 
        type: "UPDATE_CONTACTS", 
        payload: [...state.contacts, ...savedContacts] 
      });
      
      toast.success(`${savedContacts.length} contacts importés avec succès`);
      onOpenChange(false);
      reset();
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Erreur lors de l'importation");
    } finally {
      setIsImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setStep(1);
    setPreview([]);
    setFullData([]);
    setMapping({});
    setTargetListId(activeListId || "list-default");
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { onOpenChange(val); if(!val) reset(); }}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importer des contacts</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          {step === 1 ? (
            <div 
              className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".csv, .xlsx, .xls" 
                className="hidden" 
                onChange={handleFileChange}
              />
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-slate-900 font-black uppercase text-xs tracking-widest">Cliquez pour sélectionner un fichier</p>
              <p className="text-slate-400 text-[10px] mt-2 font-bold uppercase tracking-wider">CSV, Excel (.xlsx, .xls)</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-green-50 p-4 rounded-xl flex items-start gap-3 border border-green-100">
                <AlertCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-green-900">Configurez votre import</p>
                  <p className="text-xs text-green-700 leading-relaxed">
                    Fichier : <strong>{file?.name}</strong> ({fullData.length - 1} lignes détectées)
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Répertoire de destination</Label>
                <Select value={targetListId} onValueChange={setTargetListId}>
                  <SelectTrigger className="w-full bg-slate-50 border-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {state.contactLists.map(list => (
                      <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Mapping des colonnes</Label>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  {CONTACT_FIELDS.map((field) => (
                    <div key={field.id} className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-black text-slate-500 flex justify-between">
                        {field.label}
                        {["firstName", "lastName", "email"].includes(field.id) && <span className="text-red-500">*</span>}
                      </Label>
                      <Select value={mapping[field.id] || "none"} onValueChange={(val) => setMapping({...mapping, [field.id]: val === "none" ? undefined : val})}>
                        <SelectTrigger className="h-9 text-xs bg-white">
                          <SelectValue placeholder="Choisir une colonne..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">--- Ne pas importer ---</SelectItem>
                          {preview[0]?.map((col, idx) => (
                            <SelectItem key={idx} value={idx.toString()}>{col || `Colonne ${idx + 1}`}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Aperçu des données</Label>
                <div className="border rounded-xl overflow-hidden bg-white shadow-sm overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        {preview[0]?.map((col, idx) => (
                          <TableHead key={idx} className="text-[10px] font-black uppercase py-2 h-auto text-slate-400">{col || `Col ${idx + 1}`}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.slice(1).map((row, rIdx) => (
                        <TableRow key={rIdx}>
                          {row.map((cell, cIdx) => (
                            <TableCell key={cIdx} className="text-[11px] py-2 text-slate-600 font-medium">{cell}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-6 border-t mt-auto">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          {step === 2 && (
            <Button className="bg-green-600 hover:bg-green-700 px-8" onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importation...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Lancer l'importation
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
