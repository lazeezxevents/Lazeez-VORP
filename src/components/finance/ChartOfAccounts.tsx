import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Search,
  Filter,
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChartOfAccounts } from "@/components/hooks/useChartOfAccounts";
import { AddAccountDialog } from "./AddAccountDialog";
import type { AccountTreeNode, AccountType } from "@/components/finance/types";

// =====================================================
// Type Icons and Colors
// =====================================================

const accountTypeConfig: Record<AccountType, { 
  icon: typeof Building2; 
  color: string;
  label: string;
}> = {
  asset: {
    icon: Building2,
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    label: "Asset",
  },
  liability: {
    icon: TrendingDown,
    color: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    label: "Liability",
  },
  equity: {
    icon: Wallet,
    color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    label: "Equity",
  },
  revenue: {
    icon: TrendingUp,
    color: "bg-green-500/10 text-green-500 border-green-500/20",
    label: "Revenue",
  },
  expense: {
    icon: DollarSign,
    color: "bg-red-500/10 text-red-500 border-red-500/20",
    label: "Expense",
  },
};

// =====================================================
// Animation Variants
// =====================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

// =====================================================
// Account Tree Node Component
// =====================================================

interface AccountNodeProps {
  node: AccountTreeNode;
  searchQuery: string;
  onSelect?: (account: AccountTreeNode) => void;
}

interface AccountNodeProps {
  node: AccountTreeNode;
  searchQuery: string;
  onSelect?: (account: AccountTreeNode) => void;
  parentName?: string | null;
}

function AccountNode({ node, searchQuery, onSelect, parentName }: AccountNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = accountTypeConfig[node.type];
  const Icon = config.icon;

  // Highlight search matches
  const highlightText = (text: string) => {
    if (!searchQuery) return text;
    
    const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <span key={i} className="bg-yellow-200 dark:bg-yellow-900/50">{part}</span>
      ) : (
        part
      )
    );
  };

  const isMatch = searchQuery && (
    node.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div
      variants={itemVariants}
      className="select-none"
    >
      <motion.div
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer
          transition-colors duration-200
          ${isMatch ? 'bg-accent/50' : 'hover:bg-accent'}
        `}
        style={{ paddingLeft: `${node.level * 24 + 12}px` }}
        onClick={() => {
          if (node.hasChildren) {
            setIsExpanded(!isExpanded);
          }
          onSelect?.(node);
        }}
        whileHover={{ x: 2 }}
        transition={{ duration: 0.15 }}
      >
        {/* Expand/Collapse Icon */}
        <div className="w-4 h-4 flex items-center justify-center">
          {node.hasChildren && (
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </motion.div>
          )}
        </div>

        {/* Account Type Icon */}
        <motion.div
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Icon className="w-4 h-4 text-muted-foreground" />
        </motion.div>

        {/* Account Code */}
        <span className="font-mono text-sm font-medium text-muted-foreground min-w-[80px]">
          {highlightText(node.code)}
        </span>

        {/* Account Name and Sub-type */}
        <div className="flex-1">
          <div className="text-sm font-medium">{highlightText(node.name)}</div>
          {node.sub_type && (
            <div className="text-xs text-muted-foreground">{node.sub_type}</div>
          )}
          {!node.sub_type && (
            <div className="text-xs text-muted-foreground">{parentName ? `Parent: ${parentName}` : "No parent account"}</div>
          )}
        </div>

        {/* Account Type Badge */}
        <Badge variant="outline" className={`${config.color} text-xs`}>
          {config.label}
        </Badge>

        {/* Balance */}
        <span className={`
          text-sm font-semibold min-w-[120px] text-right
          ${node.balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
        `}>
          {node.currency} {node.balance.toLocaleString('en-US', { 
            minimumFractionDigits: 2,
            maximumFractionDigits: 2 
          })}
        </span>

        {/* Active Status */}
        {!node.is_active && (
          <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20 text-xs">
            Inactive
          </Badge>
        )}
      </motion.div>

      {/* Children */}
      <AnimatePresence>
        {isExpanded && node.children.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {node.children.map(child => (
              <AccountNode
                key={child.id}
                node={child}
                searchQuery={searchQuery}
                onSelect={onSelect}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// =====================================================
// Main Chart of Accounts Component
// =====================================================

export function ChartOfAccounts() {
  const { accountTree, accounts, isLoading, isError, error } = useChartOfAccounts();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<AccountType | "all">("all");
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Filter accounts
  const filteredTree = accountTree.filter(node => {
    if (filterType !== "all" && node.type !== filterType) {
      return false;
    }
    return true;
  });

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Chart of accounts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Chart of accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-destructive">
            <p className="font-medium">Failed to load accounts</p>
            <p className="text-sm">{error?.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (accountTree.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Chart of accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No accounts found</p>
            <p className="text-sm">Create your first account to get started</p>
            <Button className="mt-4" size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create account
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Chart of accounts
          </CardTitle>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add account
            </Button>
          </motion.div>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search accounts by code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={(value) => setFilterType(value as AccountType | "all")}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="asset">Assets</SelectItem>
              <SelectItem value="liability">Liabilities</SelectItem>
              <SelectItem value="equity">Equity</SelectItem>
              <SelectItem value="revenue">Revenue</SelectItem>
              <SelectItem value="expense">Expenses</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-1"
        >
          {filteredTree.map(node => (
            <AccountNode
              key={node.id}
              node={node}
              searchQuery={searchQuery}
              parentName={node.parent_account_id ? accounts.find(a=>a.id===node.parent_account_id)?.name ?? null : null}
            />
          ))}
        </motion.div>

        {filteredTree.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No accounts match your filters</p>
            <p className="text-sm">Try adjusting your search or filter</p>
          </div>
        )}
      </CardContent>

      {/* Add Account Dialog */}
      <AddAccountDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
    </Card>
  );
}
