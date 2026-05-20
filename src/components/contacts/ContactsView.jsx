import React, { useState, useMemo, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { usePermissions } from "@/hooks/usePermissions";
import { db } from "@/lib/db";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Building2, 
  Phone,
  Mail,
  MoreVertical, 
  Search, 
  Plus, 
  Filter,
  Users,
  Briefcase,
  Check,
  FolderOpen,
  FileText,
  ChevronRight,
  PlusCircle,
  Folder,
  Trash2,
  ChevronLeft,
  Calendar,
  Clock,
  ArrowUpDown,
  SortAsc,
  SortDesc,
  Upload,
  Sparkles,
  Loader2
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import ContactSheet from "./ContactSheet";
import ImportContactsDialog from "./ImportContactsDialog";
import NewCardDialog from "../pipeline/NewCardDialog";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";

export default function ContactsView() {
  const { state, dispatch } = useApp();
  const { canDeleteContact, isAdmin } = usePermissions();
  
  // State for Lists
  const [activeListId, setActiveListId] = useState("list-default");
  const [isNewListOpen, setIsNewPipelineOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  
  // Filtering State
  const [searchTerm, setSearchTerm] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState({ key: "lastModified", direction: "desc" });
  const [isCleaning, setIsCleaning] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;
  
  // Editing & UI State
  const [selectedContact, setSelectedContact] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isNewCardOpen, setIsNewCardOpen] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [tempComment, setTempComment] = useState("");

  const contacts = Array.isArray(state?.contacts) ? state.contacts : [];
  const contactLists = Array.isArray(state?.contactLists) ? state.contactLists : [];

  // Reset page when list or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeListId, searchTerm, tagFilter, sectorFilter, agentFilter, sortConfig]);

  // Filter contacts by active list
  const listContacts = useMemo(() => {
    if (activeListId === "list-default") return contacts;
    return contacts.filter(c => c.listId === activeListId);
  }, [contacts, activeListId]);

  // Unique sectors for the current view
  const sectors = useMemo(() => {
    const s = new Set();
    listContacts.forEach(c => { if(c.industry) s.add(c.industry); });
    return Array.from(s);
  }, [listContacts]);

  const filteredContacts = useMemo(() => {
    let result = listContacts.filter(contact => {
      const search = (searchTerm || "").toLowerCase();
      const fullName = `${contact.firstName || ""} ${contact.lastName || ""}`.toLowerCase();
      const company = (contact.company || "").toLowerCase();
      const phone = (contact.phone || "").toLowerCase();
      
      const matchesSearch = fullName.includes(search) || company.includes(search) || phone.includes(search);
      const matchesTag = tagFilter === "all" || (Array.isArray(contact.tags) && contact.tags.includes(tagFilter));
      const matchesSector = sectorFilter === "all" || contact.industry === sectorFilter;
      const matchesAgent = agentFilter === "all" || contact.assignedAgentId === agentFilter;
      
      return matchesSearch && matchesTag && matchesSector && matchesAgent;
    });

    // Apply Sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        let aVal = a[sortConfig.key] || "";
        let bVal = b[sortConfig.key] || "";

        if (sortConfig.key === "name") {
          aVal = `${a.firstName || ""} ${a.lastName || ""}`.toLowerCase();
          bVal = `${b.firstName || ""} ${b.lastName || ""}`.toLowerCase();
        } else if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [listContacts, searchTerm, tagFilter, sectorFilter, agentFilter, sortConfig]);

  const paginatedContacts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredContacts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredContacts, currentPage]);

  const totalPages = Math.ceil(filteredContacts.length / ITEMS_PER_PAGE);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  const handleCreateList = async () => {
    if (!newListName) return;
    try {
      const newListData = {
        name: newListName,
        color: "#16a34a",
        icon: "folder"
      };
      const savedList = await db.insertContactList(newListData);
      dispatch({ type: "UPDATE_CONTACT_LISTS", payload: [...contactLists, savedList] });
      setActiveListId(savedList.id);
      setIsNewPipelineOpen(false);
      setNewListName("");
      toast.success("Nouveau répertoire créé");
    } catch (error) {
      toast.error("Erreur lors de la création du répertoire");
    }
  };

  const handleDeleteList = async (listId) => {
    if (listId === "list-default") {
      toast.error("Impossible de supprimer le répertoire par défaut");
      return;
    }
    try {
      await db.deleteContactList(listId);
      const updatedLists = contactLists.filter(l => l.id !== listId);
      const updatedContacts = contacts.filter(c => c.listId !== listId);
      dispatch({ type: "UPDATE_CONTACT_LISTS", payload: updatedLists });
      dispatch({ type: "UPDATE_CONTACTS", payload: updatedContacts });
      setActiveListId("list-default");
      toast.info("Répertoire supprimé avec succès");
    } catch (error) {
      toast.error("Erreur lors de la suppression du répertoire");
    }
  };

  const handleCleanupDuplicates = async () => {
    const contactsWithSiret = contacts.filter(c => c.siret && c.siret.trim() !== "");
    const groupedBySiret = {};
    
    contactsWithSiret.forEach(c => {
      const s = c.siret.trim();
      if (!groupedBySiret[s]) groupedBySiret[s] = [];
      groupedBySiret[s].push(c);
    });

    const idsToDelete = [];
    Object.values(groupedBySiret).forEach(group => {
      if (group.length > 1) {
        // Sort by creation date, oldest first
        const sorted = group.sort((a, b) => new Date(a.createdAt || a.lastModified) - new Date(b.createdAt || b.lastModified));
        // Keep the first (oldest), delete the rest
        const duplicates = sorted.slice(1);
        duplicates.forEach(d => idsToDelete.push(d.id));
      }
    });

    if (idsToDelete.length === 0) {
      toast.info("Aucun doublon détecté (basé sur le SIRET)");
      return;
    }

    if (!confirm(`Le système a détecté ${idsToDelete.length} doublons. Voulez-vous les supprimer ? La version la plus ANCIENNE de chaque contact sera conservée.`)) {
      return;
    }

    setIsCleaning(true);
    try {
      await db.bulkDeleteContacts(idsToDelete);
      const updatedContacts = contacts.filter(c => !idsToDelete.includes(c.id));
      dispatch({ type: "UPDATE_CONTACTS", payload: updatedContacts });
      toast.success(`${idsToDelete.length} doublons supprimés avec succès`);
    } catch (error) {
      console.error("Cleanup error:", error);
      toast.error(`Erreur lors du nettoyage : ${error.message || "Problème de connexion"}`);
    } finally {
      setIsCleaning(false);
    }
  };

  const startEditingComment = (e, contact) => {
    e.stopPropagation();
    setEditingCommentId(contact.id);
    setTempComment(contact.notes || "");
  };

  const saveComment = async (contactId) => {
    try {
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) return;
      
      const updatedContact = await db.updateContact(contactId, { ...contact, notes: tempComment });
      const updated = contacts.map(c => 
        c.id === contactId ? updatedContact : c
      );
      dispatch({ type: "UPDATE_CONTACTS", payload: updated });
      setEditingCommentId(null);
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde du commentaire");
    }
  };

  const handleCreateDealForContact = (e, contact) => {
    e.stopPropagation();
    setSelectedContact(contact);
    setIsNewCardOpen(true);
  };

  const getTagBadgeColor = (tag) => {
    switch (tag) {
      case "client": return "bg-green-100 text-green-700 border-green-200";
      case "prospect": return "bg-blue-100 text-blue-700 border-blue-200";
      case "partenaire": return "bg-purple-100 text-purple-700 border-purple-200";
      default: return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const currentList = contactLists.find(l => l.id === activeListId) || contactLists[0];

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="ml-1 w-3 h-3 text-slate-300" />;
    return sortConfig.direction === "asc" ? <SortAsc className="ml-1 w-3 h-3 text-green-600" /> : <SortDesc className="ml-1 w-3 h-3 text-green-600" />;
  };

  return (
    <div className="flex h-full gap-6">
      {/* Sidebar */}
      <div className="w-64 shrink-0 flex flex-col gap-6">
        <div className="bg-white rounded-2xl border shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Répertoires</h3>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600" onClick={() => setIsNewPipelineOpen(true)}>
              <PlusCircle className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="space-y-1">
            {contactLists.map(list => (
              <div 
                key={list.id}
                onClick={() => setActiveListId(list.id)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${activeListId === list.id ? 'bg-green-600 text-white shadow-md shadow-green-100' : 'hover:bg-slate-50 text-slate-600'}`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <Folder className={`w-4 h-4 shrink-0 ${activeListId === list.id ? 'text-white' : 'text-slate-400'}`} />
                  <span className="text-sm font-bold truncate">{list.name}</span>
                </div>
                {isAdmin && activeListId !== list.id && list.id !== "list-default" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button 
                        className="p-1 hover:bg-red-500/20 rounded transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer le répertoire ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Voulez-vous vraiment supprimer <strong>{list.name}</strong> ?<br />
                          Cela supprimera également les <strong>{contacts.filter(c => c.listId === list.id).length} contacts</strong> associés.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => handleDeleteList(list.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Confirmer la suppression
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-green-600 rounded-2xl p-6 text-white shadow-xl shadow-green-100 relative overflow-hidden">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 text-white">Total Contacts</p>
          <h4 className="text-3xl font-black mt-1 text-white">{contacts.length}</h4>
          <Users className="absolute -bottom-2 -right-2 w-16 h-16 opacity-10 text-white" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-6 min-w-0">
        <div className="flex justify-between items-end bg-white p-6 rounded-2xl border shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-100 py-0 text-[10px] font-black uppercase">Vue Active</Badge>
              <h2 className="text-2xl font-black text-slate-900">{currentList?.name}</h2>
            </div>
            <p className="text-slate-500 text-sm font-medium">{listContacts.length} contacts affichés</p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Button 
                variant="outline" 
                onClick={handleCleanupDuplicates} 
                disabled={isCleaning}
                className="border-amber-200 text-amber-700 hover:bg-amber-50"
              >
                {isCleaning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Nettoyer les doublons
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsImportOpen(true)} className="border-slate-200 text-slate-600 hover:bg-slate-50">
              <Upload className="w-4 h-4 mr-2" /> Importer
            </Button>
            <Button onClick={() => { setSelectedContact(null); setIsSheetOpen(true); }} className="bg-green-600 hover:bg-green-700 shadow-lg shadow-green-100 px-6 text-white">
              <Plus className="w-4 h-4 mr-2" /> Nouveau Contact
            </Button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder={`Rechercher...`} 
              className="pl-10 border-slate-100 bg-slate-50/50" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs border-slate-100 bg-slate-50/50">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes Catégories</SelectItem>
                <SelectItem value="client">Clients</SelectItem>
                <SelectItem value="prospect">Prospects</SelectItem>
                <SelectItem value="partenaire">Partenaires</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs border-slate-100 bg-slate-50/50">
                <SelectValue placeholder="Secteur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous Secteurs</SelectItem>
                {sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs border-slate-100 bg-slate-50/50">
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les Agents</SelectItem>
                {(state?.users || []).map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
            
            {(tagFilter !== "all" || sectorFilter !== "all" || agentFilter !== "all" || searchTerm) && (
              <Button variant="ghost" size="sm" className="text-[10px] text-slate-400 uppercase font-bold" onClick={() => {
                setSearchTerm("");
                setTagFilter("all");
                setSectorFilter("all");
                setAgentFilter("all");
              }}>
                Effacer filtres
              </Button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead onClick={() => handleSort("name")} className="font-bold text-slate-900 text-xs cursor-pointer hover:bg-slate-100/50 transition-colors">
                  <div className="flex items-center">Nom <SortIcon columnKey="name" /></div>
                </TableHead>
                <TableHead onClick={() => handleSort("company")} className="font-bold text-slate-900 text-xs cursor-pointer hover:bg-slate-100/50 transition-colors">
                  <div className="flex items-center">Entreprise <SortIcon columnKey="company" /></div>
                </TableHead>
                <TableHead className="font-bold text-slate-900 text-xs">SIRET</TableHead>
                <TableHead className="font-bold text-slate-900 text-xs">CP</TableHead>
                <TableHead onClick={() => handleSort("industry")} className="font-bold text-slate-900 text-xs cursor-pointer hover:bg-slate-100/50 transition-colors">
                  <div className="flex items-center">Secteur <SortIcon columnKey="industry" /></div>
                </TableHead>
                <TableHead className="font-bold text-slate-900 text-xs">Téléphone</TableHead>
                <TableHead className="font-bold text-slate-900 text-xs">Email</TableHead>
                <TableHead onClick={() => handleSort("lastModified")} className="font-bold text-slate-900 text-xs cursor-pointer hover:bg-slate-100/50 transition-colors">
                  <div className="flex items-center">Modifié <SortIcon columnKey="lastModified" /></div>
                </TableHead>
                <TableHead className="font-bold text-slate-900 text-xs">Agent</TableHead>
                <TableHead className="font-bold text-slate-900 w-[200px] text-xs">Commentaires</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-40 text-center text-slate-400 italic text-sm">Aucun résultat</TableCell>
                </TableRow>
              ) : (
                paginatedContacts.map((contact) => {
                  const agent = state?.users?.find(u => u.id === contact.assignedAgentId);
                  return (
                    <TableRow key={contact.id} className="cursor-pointer group hover:bg-slate-50/30 transition-colors" onClick={() => { setSelectedContact(contact); setIsSheetOpen(true); }}>
                      <TableCell className="font-black text-slate-800 py-4 text-xs">
                        {contact.firstName} {contact.lastName}
                      </TableCell>
                      <TableCell className="text-slate-600 font-medium text-xs">
                        {contact.company || "-"}
                      </TableCell>
                      <TableCell className="text-slate-500 text-[10px] font-mono">
                        {contact.siret || "-"}
                      </TableCell>
                      <TableCell className="text-slate-500 text-[10px] font-bold">
                        {contact.postalCode || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] uppercase font-bold bg-slate-50 border-slate-100">
                          {contact.industry || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 font-bold whitespace-nowrap">
                        {contact.phone || "-"}
                      </TableCell>
                      <TableCell className="text-[11px] text-blue-600 font-medium truncate max-w-[120px]">
                        {contact.email || "-"}
                      </TableCell>
                      <TableCell className="text-[10px] text-slate-400 whitespace-nowrap">
                        {contact.lastModified ? format(new Date(contact.lastModified), "dd/MM HH:mm") : "-"}
                      </TableCell>
                      <TableCell>
                        {agent ? (
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full border shadow-sm" style={{ backgroundColor: agent.color || "#ccc" }} />
                            <span className="text-[11px] font-bold text-slate-700">{agent.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-[10px] italic">Libre</span>
                        )}
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        {editingCommentId === contact.id ? (
                          <div className="flex items-center gap-2">
                            <Input 
                              autoFocus
                              className="h-8 text-[11px] border-green-300"
                              value={tempComment}
                              onChange={e => setTempComment(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && saveComment(contact.id)}
                              onBlur={() => saveComment(contact.id)}
                            />
                          </div>
                        ) : (
                          <div 
                            className="text-[11px] text-slate-500 line-clamp-1 italic hover:bg-slate-100 p-1 rounded cursor-text"
                            onClick={(e) => startEditingComment(e, contact)}
                          >
                            {contact.notes || "Note..."}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedContact(contact); setIsSheetOpen(true); }}>
                              Détails / Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => handleCreateDealForContact(e, contact)} className="text-green-600 font-bold">
                              <Briefcase className="w-4 h-4 mr-2" /> Créer une Affaire
                            </DropdownMenuItem>
                            {isAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem className="text-red-600" onSelect={(e) => e.preventDefault()}>
                                    <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Supprimer le contact ?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Voulez-vous vraiment supprimer <strong>{contact.firstName} {contact.lastName}</strong> ?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => dispatch({ type: "UPDATE_CONTACTS", payload: contacts.filter(c => c.id !== contact.id) })} className="bg-red-600">Supprimer</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border shadow-sm">
            <div className="text-xs text-slate-500 font-medium">
              Affichage de <span className="font-bold text-slate-900">{((currentPage - 1) * ITEMS_PER_PAGE) + 1}</span> à <span className="font-bold text-slate-900">{Math.min(currentPage * ITEMS_PER_PAGE, filteredContacts.length)}</span> sur <span className="font-bold text-slate-900">{filteredContacts.length}</span>
            </div>
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 flex gap-2" 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              >
                <ChevronLeft className="w-4 h-4" /> Précédent
              </Button>
              <span className="text-xs font-bold text-slate-600 tracking-widest uppercase">Page {currentPage} / {totalPages}</span>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 flex gap-2" 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              >
                Suivant <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialog creation nouvelle liste */}
      <Dialog open={isNewListOpen} onOpenChange={setIsNewPipelineOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Nouveau Répertoire</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom du fichier / liste</Label>
              <Input 
                placeholder="Ex: Prospects Salon 2025" 
                value={newListName} 
                onChange={e => setNewListName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateList()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewPipelineOpen(false)}>Annuler</Button>
            <Button className="bg-green-600 text-white" onClick={handleCreateList}>Créer la liste</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ContactSheet 
        contact={selectedContact} 
        open={isSheetOpen} 
        onOpenChange={setIsSheetOpen} 
        activeListId={activeListId}
      />

      <ImportContactsDialog 
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        activeListId={activeListId}
      />

      <NewCardDialog 
        open={isNewCardOpen}
        onOpenChange={setIsNewCardOpen}
        defaultContactId={selectedContact?.id}
      />
    </div>
  );
}
