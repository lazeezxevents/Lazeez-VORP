/**
 * Receipt Search Interface
 * Task 23.4: Build receipt search interface
 * Requirements: 10.11
 * 
 * Advanced search and filtering for receipts
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Filter, X, Calendar as CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { ReceiptCategory, ReceiptStatus, ReceiptQuery } from "./types";

interface ReceiptSearchInterfaceProps {
  onSearch: (query: ReceiptQuery) => void;
  initialQuery?: ReceiptQuery;
}

export function ReceiptSearchInterface({
  onSearch,
  initialQuery,
}: ReceiptSearchInterfaceProps) {
  const [searchText, setSearchText] = useState(initialQuery?.searchText || '');
  const [category, setCategory] = useState<ReceiptCategory | 'all'>(
    initialQuery?.category || 'all'
  );
  const [status, setStatus] = useState<ReceiptStatus | 'all'>(
    initialQuery?.status || 'all'
  );
  const [startDate, setStartDate] = useState<Date | undefined>(
    initialQuery?.startDate ? new Date(initialQuery.startDate) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    initialQuery?.endDate ? new Date(initialQuery.endDate) : undefined
  );
  const [tags, setTags] = useState<string[]>(initialQuery?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = () => {
    const query: ReceiptQuery = {
      searchText: searchText || undefined,
      category: category !== 'all' ? category : undefined,
      status: status !== 'all' ? status : undefined,
      startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
      endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
      tags: tags.length > 0 ? tags : undefined,
    };

    onSearch(query);
  };

  const handleReset = () => {
    setSearchText('');
    setCategory('all');
    setStatus('all');
    setStartDate(undefined);
    setEndDate(undefined);
    setTags([]);
    setTagInput('');
    onSearch({});
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const hasActiveFilters =
    searchText ||
    category !== 'all' ||
    status !== 'all' ||
    startDate ||
    endDate ||
    tags.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Search receipts</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            {showFilters ? 'Hide filters' : 'Show filters'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by merchant, amount, or description..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch}>
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4 pt-4 border-t"
          >
            {/* Category and Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as ReceiptCategory | 'all')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    <SelectItem value="riders">Riders</SelectItem>
                    <SelectItem value="vendors">Vendors</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(value) => setStatus(value as ReceiptStatus | 'all')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processed">Processed</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'MMM d, yyyy') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>End date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'MMM d, yyyy') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add tag to filter..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddTag();
                    }
                  }}
                />
                <Button size="sm" onClick={handleAddTag}>
                  Add
                </Button>
              </div>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="cursor-pointer hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      {tag}
                      <X className="w-3 h-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between pt-2">
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={!hasActiveFilters}
              >
                <X className="w-4 h-4 mr-2" />
                Clear filters
              </Button>
              <Button onClick={handleSearch}>
                <Search className="w-4 h-4 mr-2" />
                Apply filters
              </Button>
            </div>
          </motion.div>
        )}

        {/* Active Filters Summary */}
        {hasActiveFilters && !showFilters && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-2"
          >
            {searchText && (
              <Badge variant="secondary">
                Search: {searchText}
                <X
                  className="w-3 h-3 ml-1 cursor-pointer"
                  onClick={() => setSearchText('')}
                />
              </Badge>
            )}
            {category !== 'all' && (
              <Badge variant="secondary">
                Category: {category}
                <X
                  className="w-3 h-3 ml-1 cursor-pointer"
                  onClick={() => setCategory('all')}
                />
              </Badge>
            )}
            {status !== 'all' && (
              <Badge variant="secondary">
                Status: {status}
                <X
                  className="w-3 h-3 ml-1 cursor-pointer"
                  onClick={() => setStatus('all')}
                />
              </Badge>
            )}
            {startDate && (
              <Badge variant="secondary">
                From: {format(startDate, 'MMM d, yyyy')}
                <X
                  className="w-3 h-3 ml-1 cursor-pointer"
                  onClick={() => setStartDate(undefined)}
                />
              </Badge>
            )}
            {endDate && (
              <Badge variant="secondary">
                To: {format(endDate, 'MMM d, yyyy')}
                <X
                  className="w-3 h-3 ml-1 cursor-pointer"
                  onClick={() => setEndDate(undefined)}
                />
              </Badge>
            )}
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                Tag: {tag}
                <X
                  className="w-3 h-3 ml-1 cursor-pointer"
                  onClick={() => handleRemoveTag(tag)}
                />
              </Badge>
            ))}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
