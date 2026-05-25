import React, { useState } from "react";
import { useApp } from "@/context/AppContext";
import { db } from "@/lib/db";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { UserCheck, UserX, Shield, Mail } from "lucide-react";

export default function UsersManagementDialog({ open, onOpenChange }) {
  const { state, refreshAllData } = useApp();
  const [loadingId, setLoadingId] = useState(null);

  const handleToggleApproval = async (userId, currentStatus) => {
    setLoadingId(userId);
    try {
      await db.updateUserProfile(userId, { is_approved: !currentStatus });
      await refreshAllData();
      toast.success(currentStatus ? "Accès révoqué" : "Utilisateur approuvé");
    } catch (error) {
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setLoadingId(null);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    setLoadingId(userId);
    try {
      await db.updateUserProfile(userId, { role: newRole });
      await refreshAllData();
      toast.success("Rôle mis à jour");
    } catch (error) {
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-600" />
            Gestion des Utilisateurs
          </DialogTitle>
          <DialogDescription>
            Approuvez les nouveaux inscrits et gérez leurs droits d'accès.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto mt-4 border rounded-xl">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0 z-10">
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Approbation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full border shadow-sm flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: user.color }}>
                        {user.name?.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900">{user.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {user.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select 
                      disabled={loadingId === user.id || user.email === 'ismail.harrouchi@strasforma.fr'}
                      value={user.role} 
                      onValueChange={(val) => handleRoleChange(user.id, val)}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                        <SelectItem value="prospecteur">Prospecteur</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {user.isApproved ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Actif</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">En attente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-3">
                      <span className="text-[10px] font-bold uppercase text-slate-400">
                        {user.isApproved ? "Approuvé" : "Bloqué"}
                      </span>
                      <Switch 
                        disabled={loadingId === user.id || user.email === 'ismail.harrouchi@strasforma.fr'}
                        checked={user.isApproved}
                        onCheckedChange={() => handleToggleApproval(user.id, user.isApproved)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
