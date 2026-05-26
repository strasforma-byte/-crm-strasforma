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
  useDraggable, 
  useDroppable, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects
} from "@dnd-kit/core";

// --- Sub-components for DnD ---

function DroppableFolder({ list, activeListId, onClick, onDelete, isAdmin, contactsCount }) {
  const { isOver, setNodeRef } = useDroppable({
    id: list.id,
  });

  const isActive = activeListId === list.id;

  return (
    <div 
      ref={setNodeRef}
      onClick={() => onClick(list.id)}
      className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
        isActive 
          ? 'bg-green-600 text-white shadow-md shadow-green-100' 
          : isOver 
            ? 'bg-green-50 text-green-700 ring-2 ring-green-400 ring-inset' 
            : 'hover:bg-slate-50 text-slate-600'
      }`}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <Folder className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : (isOver ? 'text-green-600' : 'text-slate-400')}`} />
        <span className="text-sm font-bold truncate">{list.name}</span>
      </div>
      
      <div className="flex items-center gap-2">
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
                  Cela supprimera également les <strong>{contactsCount} contacts</strong> associés.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => onDelete(list.id)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Confirmer la suppression
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}

function DroppableAllContacts({ activeListId, onClick }) {
  const { isOver, setNodeRef } = useDroppable({
    id: "list-default",
  });

  const isActive = activeListId === "list-default";

  return (
    <div 
      ref={setNodeRef}
      onClick={() => onClick("list-default")}
      className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
        isActive 
          ? 'bg-green-600 text-white shadow-md shadow-green-100' 
          : isOver 
            ? 'bg-green-50 text-green-700 ring-2 ring-green-400 ring-inset' 
            : 'hover:bg-slate-50 text-slate-600'
      }`}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <Users className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : (isOver ? 'text-green-600' : 'text-slate-400')}`} />
        <span className="text-sm font-bold truncate">Tous les contacts</span>
      </div>
    </div>
  );
}

function DraggableContactRow({ contact, children, onSelect, isSelected }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: contact.id,
    data: contact
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 50 : undefined,
  } : undefined;

  return (
    <TableRow 
      ref={setNodeRef} 
      style={style}
      className={`cursor-pointer group transition-colors ${isSelected ? 'bg-green-50/50' : (isDragging ? "opacity-50 bg-slate-100 ring-2 ring-green-500 ring-inset" : "hover:bg-slate-50/30")}`}
      onClick={onSelect}
    >
      <TableCell className="w-10 px-0 pl-3" onClick={e => e.stopPropagation()}>
        <div {...attributes} {...listeners} className="p-2 cursor-grab active:cursor-grabbing hover:bg-slate-100 rounded-md transition-colors">
          <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
        </div>
      </TableCell>
      {children}
    </TableRow>
  );
}

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

  const [isNewListOpen, setIsNewPipelineOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  
  // Filtering State
  const [searchTerm, setSearchTerm] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Dialog State
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isNewCardOpen, setIsNewCardOpen] = useState(false);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [isCleaning, setIsCleaning] = useState(false);

  // Jump to record from global search
  useEffect(() => {
    if (jumpToId && state.contacts.length > 0) {
      const targetContact = state.contacts.find(c => c.id === jumpToId);
      if (targetContact) {
        setSelectedContact(targetContact);
        setActiveListId(targetContact.listId || "list-default");
        setIsSheetOpen(true);
        onJumpHandled();
      }
    }
  }, [jumpToId, state.contacts]);
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
      const lowTerm = searchTerm.toLowerCase();
      result = result.filter(c => 
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(lowTerm) ||
        (c.company || "").toLowerCase().includes(lowTerm) ||
        (c.email || "").toLowerCase().includes(lowTerm)
      );
    }

    if (tagFilter !== "all") {
      result = result.filter(c => c.tags?.includes(tagFilter));
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragStart = (event) => {
    // Logic if needed
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const contactId = active.id;
    const targetListId = over.id;

    if (active.data.current.listId === targetListId) return;

    try {
      await db.updateContact(contactId, { listId: targetListId });
      const updated = contacts.map(c => c.id === contactId ? { ...c, listId: targetListId } : c);
      dispatch({ type: "UPDATE_CONTACTS", payload: updated });
      toast.success("Contact déplacé");
    } catch (error) {
      toast.error("Erreur lors du déplacement");
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    try {
      const newList = await db.insertContactList({
        name: newListName,
        createdBy: state.currentUser.id
      });
      dispatch({ type: "UPDATE_CONTACT_LISTS", payload: [...contactLists, newList] });
      setNewListName("");
      setIsNewPipelineOpen(false);
      toast.success("Liste créée");
    } catch (error) {
      toast.error("Erreur lors de la création de la liste");
    }
  };

  const handleDeleteList = async (id) => {
    try {
      await db.deleteContactList(id);
      dispatch({ type: "UPDATE_CONTACT_LISTS", payload: contactLists.filter(l => l.id !== id) });
      dispatch({ type: "UPDATE_CONTACTS", payload: contacts.filter(c => c.listId !== id) });
      if (activeListId === id) setActiveListId("list-default");
      toast.success("Liste supprimée");
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleCleanupDuplicates = async () => {
    setIsCleaning(true);
    try {
      const seen = new Set();
      const toDelete = [];
      const kept = [];

      contacts.forEach(c => {
        const key = `${c.company}-${c.lastName}-${c.email}`.toLowerCase();
        if (seen.has(key)) toDelete.push(c.id);
        else {
          seen.add(key);
          kept.push(c);
        }
      });

      if (toDelete.length > 0) {
        await Promise.all(toDelete.map(id => db.deleteContact(id)));
        dispatch({ type: "UPDATE_CONTACTS", payload: kept });
        toast.success(`${toDelete.length} doublons supprimés`);
      } else {
        toast.info("Aucun doublon trouvé");
      }
    } catch (error) {
      toast.error("Erreur lors du nettoyage");
    } finally {
      setIsCleaning(false);
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  const startEditingComment = (e, contact) => {
    e.stopPropagation();
    setEditingCommentId(contact.id);
    setTempComment(contact.notes || "");
  };

  const saveComment = async (contactId) => {
    if (editingCommentId !== contactId) return;
    try {
      const contact = contacts.find(c => c.id === contactId);
      const updatedContact = { ...contact, notes: tempComment };
      await db.updateContact(contactId, updatedContact);
      const updated = contacts.map(c => c.id === contactId ? updatedContact : c);
      dispatch({ type: "UPDATE_CONTACTS", payload: updated });
      setEditingCommentId(null);
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde du commentaire");
    }
  };

  const handleExportExcel = () => {
    try {
      const dataToExport = filteredContacts.map(c => {
        const agent = state.users.find(u => u.id === c.assignedAgentId);
        return {
          Prénom: c.firstName,
          Nom: c.lastName,
          Société: c.company,
          Email: c.email,
          Téléphone: c.phone,
          SIRET: c.siret,
          CP: c.postalCode,
          Secteur: c.industry,
          Tags: (c.tags || []).join(", "),
          Agent: agent?.name || "Libre",
          "Dernière Modification": c.lastModified ? format(new Date(c.lastModified), "dd/MM/yyyy HH:mm") : "-"
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");
      const fileName = `crm-contacts-${currentList.name.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success("Fichier Excel généré avec succès");
    } catch (error) {
      console.error("Excel export error:", error);
      toast.error("Erreur lors de l'exportation Excel");
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

  const handleDeleteContact = async (contactId) => {
    try {
      await db.deleteContact(contactId);
      dispatch({ type: "UPDATE_CONTACTS", payload: contacts.filter(c => c.id !== contactId) });
      toast.success("Contact supprimé avec succès");
    } catch (error) {
      console.error("Error deleting contact:", error);
      toast.error("Erreur lors de la suppression du contact");
    }
  };

  const currentList = contactLists.find(l => l.id === activeListId) || (activeListId === "list-default" ? { name: "Tous les contacts" } : contactLists[0]);
  const today = new Date();

  const LastInteraction = ({ contact }) => {
    const lastDate = useMemo(() => {
      // 1. Get dates from interactions
      const interactionDates = (contact.interactions || []).map(i => new Date(i.date).getTime());
      
      // 2. Get dates from completed tasks
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

    if (!nextTask) return <span className="text-[10px] text-slate-300 italic">Aucune</span>;

    const taskDate = new Date(nextTask.date);
    const isLate = taskDate < today && !isToday(taskDate);
    const isDueToday = isToday(taskDate);

    return (
      <div className={`flex items-center gap-1.5 text-[11px] font-bold ${isLate ? 'text-red-500' : isDueToday ? 'text-orange-500' : 'text-green-600'}`}>
        {isLate ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
        <span>{format(taskDate, "dd MMM", { locale: fr })}</span>
      </div>
    );
  };

  const dropAnimation = { sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.5" } } }) };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex h-full gap-6 p-6 overflow-hidden">
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
              <DroppableAllContacts activeListId={activeListId} onClick={setActiveListId} />
              {contactLists.map(list => (
                <DroppableFolder 
                  key={list.id} list={list} activeListId={activeListId} 
                  onClick={setActiveListId} onDelete={handleDeleteList} isAdmin={isAdmin}
                  contactsCount={contacts.filter(c => c.listId === list.id).length}
                />
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
        <div className="flex-1 space-y-6 min-w-0 flex flex-col overflow-hidden">
          <div className="flex justify-between items-end bg-white p-6 rounded-2xl border shadow-sm shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-100 py-0 text-[10px] font-black uppercase">Vue Active</Badge>
                <h2 className="text-2xl font-black text-slate-900">{currentList?.name}</h2>
              </div>
              <p className="text-slate-500 text-sm font-medium">{listContacts.length} contacts affichés</p>
            </div>
            <div className="flex items-center gap-3">
              {isAdmin && (
                <Button variant="outline" onClick={handleCleanupDuplicates} disabled={isCleaning} className="border-amber-200 text-amber-700 hover:bg-amber-50">
                  {isCleaning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Nettoyer les doublons
                </Button>
              )}
              <Button variant="outline" onClick={handleExportExcel} className="border-slate-200 text-slate-600 hover:bg-slate-50">
                <Download className="w-4 h-4 mr-2" /> Exporter Excel
              </Button>
              <Button variant="outline" onClick={() => setIsImportOpen(true)} className="border-slate-200 text-slate-600 hover:bg-slate-50">
                <Upload className="w-4 h-4 mr-2" /> Importer
              </Button>
              <Button onClick={() => { setSelectedContact(null); setIsSheetOpen(true); }} className="bg-green-600 hover:bg-green-700 shadow-lg shadow-green-100 px-6 text-white font-bold">
                <Plus className="w-4 h-4 mr-2" /> Nouveau Contact
              </Button>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-4 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder={`Rechercher un nom, entreprise ou email...`} className="pl-10 border-slate-100 bg-slate-50/50" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-3">
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="w-[140px] h-9 text-xs border-slate-100 bg-slate-50/50"><SelectValue placeholder="Catégorie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes Catégories</SelectItem>
                  <SelectItem value="client">Clients</SelectItem>
                  <SelectItem value="prospect">Prospects</SelectItem>
                  <SelectItem value="partenaire">Partenaires</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sectorFilter} onValueChange={setSectorFilter}>
                <SelectTrigger className="w-[140px] h-9 text-xs border-slate-100 bg-slate-50/50"><SelectValue placeholder="Secteur" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous Secteurs</SelectItem>
                  {sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={agentFilter} onValueChange={setAgentFilter}>
                <SelectTrigger className="w-[140px] h-9 text-xs border-slate-100 bg-slate-50/50"><SelectValue placeholder="Agent" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les Agents</SelectItem>
                  {(state?.users || []).map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col flex-1">
            {/* Bulk Action Bar */}
            {selectedIds.length > 0 && (
              <div className="bg-green-50 border-b border-green-100 px-6 py-2 flex items-center justify-between animate-in slide-in-from-top-2 z-20">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold text-green-700">{selectedIds.length} contact(s) sélectionnés</span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])} className="h-7 text-[10px] text-green-600 hover:bg-green-100 font-bold uppercase tracking-wider">Annuler</Button>
                </div>
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
                      <FolderOpen className="w-3.5 h-3.5 mr-2" />
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
            )}

            <div className="flex-1 overflow-auto">
              <Table>
                <TableHeader className="bg-slate-50/50 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-10 pl-3">
                      <input 
                        type="checkbox"
                        className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500 accent-green-600 cursor-pointer"
                        checked={paginatedContacts.length > 0 && selectedIds.length === paginatedContacts.length} 
                        onChange={handleToggleSelectAll} 
                      />
                    </TableHead>
                    <TableHead className="w-10"></TableHead>
                    <TableHead onClick={() => handleSort("name")} className="font-bold text-slate-900 text-xs cursor-pointer hover:bg-slate-100/50 transition-colors">
                      <div className="flex items-center">Nom <SortIcon columnKey="name" sortConfig={sortConfig} /></div>
                    </TableHead>
                    <TableHead onClick={() => handleSort("company")} className="font-bold text-slate-900 text-xs cursor-pointer hover:bg-slate-100/50 transition-colors">
                      <div className="flex items-center">Entreprise <SortIcon columnKey="company" sortConfig={sortConfig} /></div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-900 text-xs">SIRET</TableHead>
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
                    <TableHead className="font-bold text-slate-900 w-[200px] text-xs">Notes</TableHead>                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedContacts.length === 0 ? (
                    <TableRow><TableCell colSpan={14} className="h-40 text-center text-slate-400 italic text-sm">Aucun résultat</TableCell></TableRow>
                  ) : (
                    paginatedContacts.map((contact) => {
                      const agent = state?.users?.find(u => u.id === contact.assignedAgentId);
                      return (
                        <DraggableContactRow key={contact.id} contact={contact} isSelected={selectedIds.includes(contact.id)} onSelect={() => { setSelectedContact(contact); setIsSheetOpen(true); }}>
                          <TableCell onClick={e => e.stopPropagation()} className="pl-3">
                            <input 
                              type="checkbox"
                              className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500 accent-green-600 cursor-pointer"
                              checked={selectedIds.includes(contact.id)} 
                              onChange={() => handleToggleSelect(contact.id)} 
                            />
                          </TableCell>
                          <TableCell className="font-black text-slate-800 py-4 text-xs">{contact.firstName} {contact.lastName}</TableCell>
                          <TableCell className="text-slate-600 font-medium text-xs">{contact.company || "-"}</TableCell>
                          <TableCell className="text-slate-500 text-[10px] font-mono">{contact.siret || "-"}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[9px] uppercase font-bold bg-slate-50 border-slate-100">{contact.industry || "-"}</Badge></TableCell>
                          <TableCell className="text-xs text-slate-600 font-bold whitespace-nowrap">{contact.phone || "-"}</TableCell>
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
                          <TableCell onClick={e => e.stopPropagation()}>                            {editingCommentId === contact.id ? (
                              <div className="flex items-center gap-2">
                                <Input autoFocus className="h-8 text-[11px] border-green-300" value={tempComment} onChange={e => setTempComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveComment(contact.id)} onBlur={() => saveComment(contact.id)} />
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-500 line-clamp-1 italic hover:bg-slate-100 p-1 rounded cursor-text" onClick={(e) => startEditingComment(e, contact)}>
                                {contact.notes || "Note..."}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical className="w-4 h-4 text-slate-400" /></Button></DropdownMenuTrigger>
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
                              </DropdownMenuContent>                            </DropdownMenu>
                          </TableCell>
                        </DraggableContactRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="px-6 py-4 bg-slate-50/50 border-t flex items-center justify-between shrink-0">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-8 flex gap-2" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}><ChevronLeft className="w-4 h-4" /> Précédent</Button>
                  <span className="text-xs font-bold text-slate-600 tracking-widest uppercase">Page {currentPage} / {totalPages}</span>
                  <Button variant="outline" size="sm" className="h-8 flex gap-2" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}>Suivant <ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dialog creation nouvelle liste */}
        <Dialog open={isNewListOpen} onOpenChange={setIsNewPipelineOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader><DialogTitle>Nouveau Répertoire</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nom du répertoire</Label>
                <Input placeholder="Ex: Prospects Salon 2025" value={newListName} onChange={e => setNewListName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateList()} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewPipelineOpen(false)}>Annuler</Button>
              <Button className="bg-green-600 text-white" onClick={handleCreateList}>Créer la liste</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
    </DndContext>
  );
}
