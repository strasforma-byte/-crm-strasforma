import React, { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
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
  User as UserIcon,
  Check,
  FolderOpen,
  FileText,
  History,
  ChevronRight,
  PlusCircle,
  Folder,
  Trash2,
  Download,
  ChevronLeft,
  Calendar,
  Clock,
  ArrowUpDown,
  SortAsc,
  SortDesc,
  Upload,
  Sparkles,
  Loader2,
  GripVertical,
  AlertTriangle
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
import TaskDialog from "../agenda/TaskDialog";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format, isToday, isSameDay } from "date-fns";
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

import { 
  DndContext, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDroppable
} from "@dnd-kit/core";
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

const SortIcon = ({ columnKey, sortConfig }) => {
  if (sortConfig.key !== columnKey) return <ArrowUpDown className="ml-1 w-3 h-3 text-slate-300" />;
  return sortConfig.direction === "asc" ? <SortAsc className="ml-1 w-3 h-3 text-green-600" /> : <SortDesc className="ml-1 w-3 h-3 text-green-600" />;
};

export default function ContactsView({ jumpToId, onJumpHandled }) {
  const { state, dispatch } = useApp();
  const { canDeleteContact, isAdmin } = usePermissions();
  
  // State for Lists
  const [activeListId, setActiveListId] = useState("list-default");
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Dialog State
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isNewCardOpen, setIsNewCardOpen] = useState(false);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [isCleaning, setIsCleaning] = useState(false);

  // Jump to record from global search
  useEffect(() => {
    if (jumpToId && Array.isArray(state?.contacts) && state.contacts.length > 0) {
      const targetContact = state.contacts.find(c => c.id === jumpToId);
      if (targetContact) {
        setSelectedContact(targetContact);
        setActiveListId(targetContact.listId || "list-default");
        setIsSheetOpen(true);
        if (onJumpHandled) onJumpHandled();
      }
    }
  }, [jumpToId, state?.contacts, onJumpHandled]);

  const [editingCommentId, setEditingCommentId] = useState(null);
  const [tempComment, setTempComment] = useState("");

  const { contactLists = [], contacts = [] } = state;
  const sectors = useMemo(() => {
    const s = new Set(contacts.map(c => c.industry).filter(Boolean));
    return Array.from(s).sort();
  }, [contacts]);

  const listContacts = useMemo(() => {
    if (activeListId === "list-default") return contacts;
    return contacts.filter(c => c.listId === activeListId);
  }, [contacts, activeListId]);

  const filteredContacts = useMemo(() => {
    let result = [...listContacts];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => 
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(term) ||
        (c.company || "").toLowerCase().includes(term) ||
        (c.email || "").toLowerCase().includes(term)
      );
    }
    
    if (tagFilter !== "all") {
      result = result.filter(c => (c.tags || []).includes(tagFilter));
    }
    
    if (sectorFilter !== "all") {
      result = result.filter(c => c.industry === sectorFilter);
    }

    if (agentFilter !== "all") {
      result = result.filter(c => c.assignedAgentId === agentFilter);
    }

    result.sort((a, b) => {
      let valA, valB;
      if (sortConfig.key === "name") {
        valA = `${a.lastName} ${a.firstName}`.toLowerCase();
        valB = `${b.lastName} ${b.firstName}`.toLowerCase();
      } else if (sortConfig.key === "lastInteraction") {
        const getTimestamp = (contact) => {
          const dates = [
            ...(contact.interactions || []).map(i => new Date(i.date).getTime()),
            ...(state.tasks || []).filter(t => (t.linkedContactId === contact.id || t.contactId === contact.id) && t.status === "done").map(t => new Date(t.date).getTime())
          ].filter(d => !isNaN(d));
          return dates.length > 0 ? Math.max(...dates) : 0;
        };
        valA = getTimestamp(a);
        valB = getTimestamp(b);
      } else if (sortConfig.key === "nextAction") {
        const getTimestamp = (contactId) => {
          const dates = (state.tasks || [])
            .filter(t => (t.linkedContactId === contactId || t.contactId === contactId) && t.status !== "done")
            .map(t => new Date(t.date).getTime())
            .filter(d => !isNaN(d));
          return dates.length > 0 ? Math.min(...dates) : Infinity;
        };
        valA = getTimestamp(a.id);
        valB = getTimestamp(b.id);
      } else {
        valA = a[sortConfig.key] || "";
        valB = b[sortConfig.key] || "";
      }
      
      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [listContacts, searchTerm, tagFilter, sectorFilter, agentFilter, sortConfig, state.tasks]);

  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
  const paginatedContacts = filteredContacts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleToggleSelectAll = () => {
    if (paginatedContacts.length > 0 && selectedIds.length === paginatedContacts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedContacts.map(c => c.id));
    }
  };

  const handleBulkMove = async (targetListId) => {
    if (selectedIds.length === 0) return;
    try {
      const updates = selectedIds.map(id => db.updateContact(id, { listId: targetListId }));
      await Promise.all(updates);
      
      const updatedContacts = state.contacts.map(c => 
        selectedIds.includes(c.id) ? { ...c, listId: targetListId } : c
      );
      dispatch({ type: "UPDATE_CONTACTS", payload: updatedContacts });
      setSelectedIds([]);
      toast.success(`${selectedIds.length} contacts déplacés`);
    } catch (error) {
      toast.error("Erreur lors du déplacement en masse");
    }
  };

  const handleBulkAssign = async (agentId) => {
    if (selectedIds.length === 0) return;
    try {
      const actualAgentId = agentId === "none" ? null : agentId;
      const updates = selectedIds.map(id => db.updateContact(id, { assignedAgentId: actualAgentId }));
      await Promise.all(updates);
      
      const updatedContacts = state.contacts.map(c => 
        selectedIds.includes(c.id) ? { ...c, assignedAgentId: actualAgentId } : c
      );
      dispatch({ type: "UPDATE_CONTACTS", payload: updatedContacts });
      setSelectedIds([]);
      toast.success(`${selectedIds.length} contacts assignés`);
    } catch (error) {
      toast.error("Erreur lors de l'assignation en masse");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      await db.bulkDeleteContacts(selectedIds);
      dispatch({ type: "UPDATE_CONTACTS", payload: contacts.filter(c => !selectedIds.includes(c.id)) });
      setSelectedIds([]);
      toast.success(`${selectedIds.length} contacts supprimés`);
    } catch (error) {
      toast.error("Erreur lors de la suppression en masse");
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  const handleDeleteContact = async (id) => {
    try {
      await db.deleteContact(id);
      dispatch({ type: "UPDATE_CONTACTS", payload: contacts.filter(c => c.id !== id) });
      toast.success("Contact supprimé");
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleCleanDuplicates = async () => {
    setIsCleaning(true);
    try {
      const siretGroups = {};
      state.contacts.forEach(c => {
        if (c.siret) {
          if (!siretGroups[c.siret]) siretGroups[c.siret] = [];
          siretGroups[c.siret].push(c);
        }
      });

      const idsToDelete = [];
      Object.values(siretGroups).forEach(group => {
        if (group.length > 1) {
          // Keep the oldest one (lowest createdAt)
          const sorted = [...group].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
          // sorted[0] is the oldest, keep it. Delete all others.
          const toDelete = sorted.slice(1).map(c => c.id);
          idsToDelete.push(...toDelete);
        }
      });

      if (idsToDelete.length === 0) {
        toast.info("Aucun doublon trouvé sur le numéro SIRET");
        setIsCleaning(false);
        return;
      }

      await db.bulkDeleteContacts(idsToDelete);
      dispatch({ type: "UPDATE_CONTACTS", payload: state.contacts.filter(c => !idsToDelete.includes(c.id)) });
      toast.success(`${idsToDelete.length} doublons supprimés avec succès`);
    } catch (error) {
      console.error("Cleaning error:", error);
      toast.error("Erreur lors du nettoyage des doublons");
    } finally {
      setIsCleaning(false);
    }
  };

  const handleCreateDealForContact = (e, contact) => {
    e.stopPropagation();
    setSelectedContact(contact);
    setIsNewCardOpen(true);
  };

  const handleCreateTaskForContact = (e, contact) => {
    e.stopPropagation();
    setSelectedContact(contact);
    setIsTaskDialogOpen(true);
  };

  const getTagBadgeColor = (tag) => {
    switch (tag) {
      case "client": return "bg-green-100 text-green-700 border-green-200";
      case "prospect": return "bg-blue-100 text-blue-700 border-blue-200";
      case "partenaire": return "bg-purple-100 text-purple-700 border-purple-200";
      default: return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const startEditingComment = (e, contact) => {
    e.stopPropagation();
    setEditingCommentId(contact.id);
    setTempComment(contact.notes || "");
  };

  const saveComment = async (id) => {
    try {
      await db.updateContact(id, { notes: tempComment });
      dispatch({ type: "UPDATE_CONTACTS", payload: contacts.map(c => c.id === id ? { ...c, notes: tempComment } : c) });
      setEditingCommentId(null);
      toast.success("Note mise à jour");
    } catch (error) {
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const handleExportExcel = () => {
    try {
      const dataToExport = filteredContacts.map(c => ({
        Société: c.company,
        Prénom: c.firstName,
        Nom: c.lastName,
        Email: c.email,
        Téléphone: c.phone,
        SIRET: c.siret,
        Secteur: c.industry,
        Tags: (c.tags || []).join(", "),
        Notes: c.notes,
        "Date Création": format(new Date(c.createdAt), "dd/MM/yyyy")
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");
      XLSX.writeFile(workbook, `crm-contacts-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Contacts exportés");
    } catch (error) {
      toast.error("Erreur lors de l'exportation");
    }
  };

  const LastInteraction = ({ contact }) => {
    const lastDate = useMemo(() => {
      const interactionDates = (contact.interactions || []).map(i => new Date(i.date).getTime());
      const taskDates = (state.tasks || [])
        .filter(t => (t.linkedContactId === contact.id || t.contactId === contact.id) && t.status === "done")
        .map(t => new Date(t.date).getTime());

      const allDates = [...interactionDates, ...taskDates].filter(d => !isNaN(d));
      if (allDates.length === 0) return null;
      return new Date(Math.max(...allDates));
    }, [contact.interactions, state.tasks, contact.id]);

    if (!lastDate) return <span className="text-[10px] text-slate-300 italic">Jamais</span>;

    return (
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
        <History className="w-3 h-3 text-slate-300" />
        <span>{format(lastDate, "dd MMM", { locale: fr })}</span>
      </div>
    );
  };

  const NextAction = ({ contactId }) => {
    const nextTask = useMemo(() => {
      const contactTasks = (state.tasks || []).filter(t => (t.linkedContactId === contactId || t.contactId === contactId) && t.status !== "done");
      if (contactTasks.length === 0) return null;
      return [...contactTasks].sort((a, b) => new Date(a.date) - new Date(b.date))[0];
    }, [state.tasks, contactId]);

    if (!nextTask) return <span className="text-[10px] text-amber-500 font-medium">À planifier</span>;

    const taskDate = new Date(nextTask.date);
    const isLate = taskDate < new Date() && !isToday(taskDate);

    return (
      <div className={cn("flex items-center gap-1.5 text-[11px] font-bold", isLate ? "text-red-600" : isToday(taskDate) ? "text-orange-600" : "text-green-600")}>
        <Clock className="w-3 h-3" />
        <span>{format(taskDate, "dd MMM", { locale: fr })}</span>
      </div>
    );
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const contactId = active.id;
    const targetListId = over.id;

    if (activeListId !== targetListId) {
      try {
        await db.updateContact(contactId, { listId: targetListId });
        dispatch({ 
          type: "UPDATE_CONTACTS", 
          payload: contacts.map(c => c.id === contactId ? { ...c, listId: targetListId } : c) 
        });
        toast.success("Contact déplacé");
      } catch (error) {
        toast.error("Erreur lors du déplacement");
      }
    }
  };

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: { opacity: "0.5" }
      }
    })
  };

  return (
    <div className="h-full flex">
      {/* Sidebar for Lists */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b">
          <Button variant="outline" className="w-full justify-start text-xs font-bold" onClick={() => setIsImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Importer Contacts
          </Button>
        </div>
        
        <div className="p-2 space-y-1 overflow-y-auto">
          <p className="px-2 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Répertoires</p>
          <div
            onClick={() => setActiveListId("list-default")}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all",
              activeListId === "list-default" ? "bg-blue-50 text-blue-700 shadow-sm" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              Tous les contacts
            </div>
            <Badge variant="ghost" className="text-[10px] p-0">{contacts.length}</Badge>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
            {contactLists.map(list => (
              <DroppableList key={list.id} list={list} activeListId={activeListId} onClick={setActiveListId} contactsCount={contacts.filter(c => c.listId === list.id).length} />
            ))}
          </DndContext>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/30">
        {/* Header with Filters */}
        <div className="bg-white border-b border-slate-200 p-4 space-y-4 shadow-sm z-20">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              {activeListId === "list-default" ? "Tous les contacts" : contactLists.find(l => l.id === activeListId)?.name}
            </h2>
            
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Rechercher un client..." 
                  className="pl-10 h-9 text-xs border-slate-200 bg-slate-50/50"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              {isAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 border-amber-200 text-amber-700 hover:bg-amber-50 font-bold">
                      {isCleaning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      Nettoyer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Nettoyer les doublons ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action va identifier tous les contacts ayant le **même numéro SIRET** et ne conserver que le **plus ancien**. Les contacts ajoutés plus récemment seront définitivement supprimés.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCleanDuplicates} className="bg-amber-600 hover:bg-amber-700">Lancer le nettoyage</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              <Button onClick={handleExportExcel} variant="outline" size="sm" className="h-9 border-slate-200">
                <Download className="w-4 h-4 mr-2" /> Exporter
              </Button>
              <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700 font-bold shadow-lg shadow-blue-100" onClick={() => { setSelectedContact(null); setIsSheetOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Nouveau
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 mr-2 tracking-widest">
              <Filter className="w-3 h-3" /> Filtrer
            </div>
            
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="h-8 w-[130px] text-[10px] bg-slate-50 border-none font-bold">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                <SelectItem value="client">Clients</SelectItem>
                <SelectItem value="prospect">Prospects</SelectItem>
                <SelectItem value="partenaire">Partenaires</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="h-8 w-[150px] text-[10px] bg-slate-50 border-none font-bold">
                <SelectValue placeholder="Secteur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les secteurs</SelectItem>
                {sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="h-8 w-[150px] text-[10px] bg-slate-50 border-none font-bold">
                <SelectValue placeholder="Responsable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les agents</SelectItem>
                {state.users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>

            {(searchTerm || tagFilter !== "all" || sectorFilter !== "all" || agentFilter !== "all") && (
              <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black text-slate-400" onClick={() => { setSearchTerm(""); setTagFilter("all"); setSectorFilter("all"); setAgentFilter("all"); }}>
                EFFACER
              </Button>
            )}
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.length > 0 && (
          <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-100 rounded-xl flex items-center justify-between animate-in slide-in-from-top-2 shadow-sm">
            <div className="flex items-center gap-4">
              <span className="text-xs font-black text-green-700 uppercase tracking-wider">{selectedIds.length} contact(s) sélectionnés</span>
              <div className="h-4 w-[1px] bg-green-200" />
              <div className="flex items-center gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 border-red-200 text-red-600 hover:bg-red-50 font-bold shadow-sm">
                      <Trash2 className="w-3.5 h-3.5 mr-2" />
                      Supprimer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer {selectedIds.length} contact(s) ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action est irréversible. Toutes les données associées à ces contacts seront définitivement supprimées.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700">Confirmer la suppression</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <div className="h-4 w-[1px] bg-green-200 mx-1" />

                <Select onValueChange={handleBulkAssign}>
                  <SelectTrigger className="h-8 w-[160px] text-[11px] bg-white border-blue-200 text-blue-700 font-bold shadow-sm">
                    <UserIcon className="w-3.5 h-3.5 mr-2" />
                    <SelectValue placeholder="Assigner à..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="italic text-slate-400">--- Libre ---</SelectItem>
                    {state.users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select onValueChange={handleBulkMove}>
                  <SelectTrigger className="h-8 w-[180px] text-[11px] bg-white border-green-200 text-green-700 font-bold shadow-sm">
                    <Folder className="w-3.5 h-3.5 mr-2" />
                    <SelectValue placeholder="Déplacer vers..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="list-default">Tous les contacts</SelectItem>
                    {contactLists.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black text-green-600 uppercase" onClick={() => setSelectedIds([])}>Annuler</Button>
          </div>
        )}

        <div className="flex-1 overflow-auto p-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="w-10">
                    <input type="checkbox" className="rounded border-slate-300" checked={paginatedContacts.length > 0 && selectedIds.length === paginatedContacts.length} onChange={handleToggleSelectAll} />
                  </TableHead>
                  <TableHead onClick={() => handleSort("lastName")} className="font-bold text-slate-900 text-xs cursor-pointer hover:bg-slate-100/50 transition-colors">
                    <div className="flex items-center">Nom <SortIcon columnKey="lastName" sortConfig={sortConfig} /></div>
                  </TableHead>
                  <TableHead onClick={() => handleSort("company")} className="font-bold text-slate-900 text-xs cursor-pointer hover:bg-slate-100/50 transition-colors">
                    <div className="flex items-center">Société <SortIcon columnKey="company" sortConfig={sortConfig} /></div>
                  </TableHead>
                  <TableHead onClick={() => handleSort("industry")} className="font-bold text-slate-900 text-xs cursor-pointer hover:bg-slate-100/50 transition-colors">
                    <div className="flex items-center">Secteur <SortIcon columnKey="industry" sortConfig={sortConfig} /></div>
                  </TableHead>
                  <TableHead className="font-bold text-slate-900 text-xs">Téléphone</TableHead>
                  <TableHead className="font-bold text-slate-900 text-xs">Agent</TableHead>
                  <TableHead onClick={() => handleSort("lastInteraction")} className="font-bold text-slate-900 text-xs cursor-pointer hover:bg-slate-100/50 transition-colors">
                    <div className="flex items-center">Dernière Relance <SortIcon columnKey="lastInteraction" sortConfig={sortConfig} /></div>
                  </TableHead>
                  <TableHead onClick={() => handleSort("nextAction")} className="font-bold text-slate-900 text-xs cursor-pointer hover:bg-slate-100/50 transition-colors">
                    <div className="flex items-center">Prochaine Action <SortIcon columnKey="nextAction" sortConfig={sortConfig} /></div>
                  </TableHead>
                  <TableHead className="font-bold text-slate-900 w-[200px] text-xs">Notes</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedContacts.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="h-40 text-center text-slate-400 italic text-sm">Aucun résultat</TableCell></TableRow>
                ) : (
                  paginatedContacts.map((contact) => {
                    const agent = state?.users?.find(u => u.id === contact.assignedAgentId);
                    return (
                      <DraggableContactRow key={contact.id} contact={contact} isSelected={selectedIds.includes(contact.id)} onSelect={() => { setSelectedContact(contact); setIsSheetOpen(true); }}>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <input type="checkbox" className="rounded border-slate-300" checked={selectedIds.includes(contact.id)} onChange={() => handleToggleSelect(contact.id)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-7 h-7 border shadow-sm">
                              <AvatarFallback className="text-[10px] font-bold bg-slate-100 text-slate-600">{contact.firstName?.charAt(0)}{contact.lastName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="font-bold text-slate-900 text-xs">{contact.firstName} {contact.lastName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-700 uppercase">{contact.company}</span>
                            <span className="text-[9px] text-slate-400 font-medium">SIRET: {contact.siret}</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-[9px] font-bold uppercase bg-slate-50/50">{contact.industry}</Badge></TableCell>
                        <TableCell className="text-xs text-slate-600 font-medium">{contact.phone}</TableCell>
                        <TableCell>
                          {agent ? (
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full border shadow-sm" style={{ backgroundColor: agent.color || "#ccc" }} />
                              <span className="text-[11px] font-bold text-slate-700">{agent.name}</span>
                            </div>
                          ) : (<span className="text-slate-300 text-[10px] italic">Libre</span>)}
                        </TableCell>
                        <TableCell><LastInteraction contact={contact} /></TableCell>
                        <TableCell><NextAction contactId={contact.id} /></TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          {editingCommentId === contact.id ? (
                            <div className="flex items-center gap-1">
                              <Input value={tempComment} onChange={e => setTempComment(e.target.value)} className="h-7 text-[10px] w-full" autoFocus onBlur={() => saveComment(contact.id)} onKeyDown={e => e.key === 'Enter' && saveComment(contact.id)} />
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500 line-clamp-1 italic hover:bg-slate-100 p-1 rounded cursor-text" onClick={(e) => startEditingComment(e, contact)}>
                              {contact.notes || "Ajouter une note..."}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900 rounded-lg"><MoreVertical className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 shadow-xl">
                              <DropdownMenuItem onClick={() => { setSelectedContact(contact); setIsSheetOpen(true); }} className="cursor-pointer">
                                <FileText className="w-4 h-4 mr-2" /> Voir Fiche
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => handleCreateTaskForContact(e, contact)} className="cursor-pointer">
                                <Calendar className="w-4 h-4 mr-2 text-blue-600" /> Nouvelle Action
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => handleCreateDealForContact(e, contact)} className="cursor-pointer">
                                <Briefcase className="w-4 h-4 mr-2 text-green-600" /> Nouvelle Affaire
                              </DropdownMenuItem>
                              {canDeleteContact(contact) && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild><DropdownMenuItem className="text-red-600 cursor-pointer" onSelect={e => e.preventDefault()}><Trash2 className="w-4 h-4 mr-2" /> Supprimer</DropdownMenuItem></AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Supprimer le contact ?</AlertDialogTitle><AlertDialogDescription>Voulez-vous vraiment supprimer <strong>{contact.firstName} {contact.lastName}</strong> ?</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteContact(contact.id)} className="bg-red-600">Supprimer</AlertDialogAction></AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </DraggableContactRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="p-4 border-t bg-slate-50/30 flex items-center justify-between">
                <p className="text-xs text-slate-500">Affichage de {paginatedContacts.length} sur {filteredContacts.length} contacts</p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}><ChevronLeft className="w-4 h-4" /></Button>
                  <div className="flex items-center px-4 h-8 bg-white border rounded-lg text-xs font-bold">{currentPage} / {totalPages}</div>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}><ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <ContactSheet contact={selectedContact} open={isSheetOpen} onOpenChange={setIsSheetOpen} activeListId={activeListId} />
        <ImportContactsDialog open={isImportOpen} onOpenChange={setIsImportOpen} activeListId={activeListId} />
        <NewCardDialog open={isNewCardOpen} onOpenChange={setIsNewCardOpen} defaultContactId={selectedContact?.id} />
        <TaskDialog 
          task={null}
          open={isTaskDialogOpen}
          onOpenChange={setIsTaskDialogOpen}
          defaultContactId={selectedContact?.id}
        />

        <DragOverlay dropAnimation={dropAnimation}>
          {/* Draggable overlay content placeholder */}
        </DragOverlay>
      </div>
    </div>
  );
}

function DroppableList({ list, activeListId, onClick, contactsCount }) {
  const { isOver, setNodeRef } = useDroppable({
    id: list.id,
  });

  const isActive = activeListId === list.id;

  return (
    <div 
      ref={setNodeRef}
      onClick={() => onClick(list.id)}
      className={cn(
        "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all",
        isActive ? "bg-blue-50 text-blue-700 shadow-sm" : "text-slate-600 hover:bg-slate-50",
        isOver && "ring-2 ring-blue-400 bg-blue-50/50"
      )}
    >
      <div className="flex items-center gap-2">
        <Folder className={cn("w-4 h-4", isActive ? "text-blue-500" : "text-slate-400")} />
        {list.name}
      </div>
      <Badge variant="ghost" className="text-[10px] p-0">{contactsCount}</Badge>
    </div>
  );
}

function DraggableContactRow({ contact, isSelected, onSelect, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: contact.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 1
  };

  return (
    <TableRow 
      ref={setNodeRef} 
      style={style}
      className={cn("group cursor-pointer hover:bg-slate-50/50 transition-colors", isSelected && "bg-blue-50/30")}
      onClick={onSelect}
      {...attributes}
      {...listeners}
    >
      {children}
    </TableRow>
  );
}
