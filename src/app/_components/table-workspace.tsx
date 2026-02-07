"use client";

import clsx from "clsx";
import { Inter } from "next/font/google";
import { useRouter } from "next/navigation";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import assigneeIcon from "~/assets/asignee.svg";
import attachmentsIcon from "~/assets/attachments.svg";
import bellIcon from "~/assets/bell.svg";
import colourIcon from "~/assets/colour.svg";
import filterIcon from "~/assets/filter.svg";
import gridViewIcon from "~/assets/grid-view.svg";
import groupIcon from "~/assets/group.svg";
import helpIcon from "~/assets/help.svg";
import hideFieldsIcon from "~/assets/hide fields.svg";
import launchIcon from "~/assets/launch.svg";
import logoIcon from "~/assets/logo.svg";
import nameIcon from "~/assets/name.svg";
import notesIcon from "~/assets/notes.svg";
import omniIcon from "~/assets/omni.svg";
import refreshIcon from "~/assets/refresh.svg";
import rowHeightIcon from "~/assets/row-height.svg";
import shareSyncIcon from "~/assets/share-and-sync.svg";
import sortIcon from "~/assets/sort.svg";
import statusIcon from "~/assets/status.svg";
import { authClient } from "~/server/better-auth/client";
import { api } from "~/trpc/react";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const MAX_TABLES = 1000;
const MAX_COLUMNS = 500;
const MAX_ROWS = 2_000_000;
const BULK_ROWS = 100_000;
const PAGE_ROWS = 50;
const ROW_HEIGHT = 33;
const DEFAULT_COLUMN_WIDTH = 181;
const MIN_COLUMN_WIDTH = 120;
const MAX_COLUMN_WIDTH = 420;
const ADD_COLUMN_WIDTH = 93;

const REQUIRED_COLUMNS = ["Name", "Notes", "Assignee", "Status", "Attachments"];

const columnIconMap: Record<string, string> = {
  Name: nameIcon.src,
  Notes: notesIcon.src,
  Assignee: assigneeIcon.src,
  Status: statusIcon.src,
  Attachments: attachmentsIcon.src,
};

const imgEllipse2 =
  "https://www.figma.com/api/mcp/asset/220c0b55-a141-4008-8b9e-393c5dcc820b";
const imgEllipse3 =
  "https://www.figma.com/api/mcp/asset/42309589-dc81-48ef-80de-6483844e93cc";

type TableRow = Record<string, string> & { id: string };

type TableWorkspaceProps = {
  baseId: string;
  userName: string;
};

type ContextMenuState =
  | {
      type: "table" | "column" | "row";
      id: string;
      x: number;
      y: number;
    }
  | null;

type ColumnResizeState = {
  columnId: string;
  startX: number;
  startWidth: number;
};

const formatUserInitial = (name: string) => {
  const trimmed = name.trim();
  const chars = Array.from(trimmed);
  const first = chars[0] ?? "";
  if (!first) return "?";
  return /[a-zA-Z]/.test(first) ? first.toUpperCase() : first;
};

export function TableWorkspace({ baseId, userName }: TableWorkspaceProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const parentRef = useRef<HTMLDivElement>(null);

  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizing, setResizing] = useState<ColumnResizeState | null>(null);
  const [cellEdits, setCellEdits] = useState<Record<string, Record<string, string>>>(
    {}
  );
  const [ensuredTableId, setEnsuredTableId] = useState<string | null>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [hoveredHeaderId, setHoveredHeaderId] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{
    rowId: string;
    columnId: string;
  } | null>(null);
  const [addRowHover, setAddRowHover] = useState(false);
  const cellRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());

  const baseDetailsQuery = api.base.get.useQuery({ baseId });
  useEffect(() => {
    utils.base.list.prefetch();
  }, [utils.base.list]);
  const tableMetaQuery = api.base.getTableMeta.useQuery(
    { tableId: activeTableId ?? "" },
    { enabled: Boolean(activeTableId) }
  );
  const rowsQuery = api.base.getRows.useInfiniteQuery(
    { tableId: activeTableId ?? "", limit: PAGE_ROWS },
    {
      enabled: Boolean(activeTableId),
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    }
  );

  const addTable = api.base.addTable.useMutation({
    onSuccess: async (data) => {
      await utils.base.get.invalidate({ baseId });
      setActiveTableId(data.id);
    },
  });

  const deleteTable = api.base.deleteTable.useMutation({
    onSuccess: async () => {
      await utils.base.get.invalidate({ baseId });
      setActiveTableId(null);
    },
  });

  const deleteColumn = api.base.deleteColumn.useMutation({
    onSuccess: async () => {
      if (activeTableId) {
        await utils.base.getTableMeta.invalidate({ tableId: activeTableId });
        await utils.base.getRows.invalidate({
          tableId: activeTableId,
          limit: PAGE_ROWS,
        });
      }
    },
  });

  const addColumn = api.base.addColumn.useMutation({
    onSuccess: async () => {
      if (activeTableId) {
        await utils.base.getTableMeta.invalidate({ tableId: activeTableId });
        await utils.base.getRows.invalidate({
          tableId: activeTableId,
          limit: PAGE_ROWS,
        });
      }
    },
  });

  const addRows = api.base.addRows.useMutation({
    onSuccess: async () => {
      if (activeTableId) {
        await utils.base.getTableMeta.invalidate({ tableId: activeTableId });
        await utils.base.getRows.invalidate({
          tableId: activeTableId,
          limit: PAGE_ROWS,
        });
      }
    },
  });

  const deleteRow = api.base.deleteRow.useMutation({
    onSuccess: async () => {
      if (activeTableId) {
        await utils.base.getTableMeta.invalidate({ tableId: activeTableId });
        await utils.base.getRows.invalidate({
          tableId: activeTableId,
          limit: PAGE_ROWS,
        });
      }
    },
  });

  const updateCell = api.base.updateCell.useMutation({
    onMutate: async ({ rowId, columnId, value }) => {
      if (!activeTableId) return { previous: null, queryKey: null };
      const queryKey = { tableId: activeTableId, limit: PAGE_ROWS };
      await utils.base.getRows.cancel(queryKey);
      const previous = utils.base.getRows.getInfiniteData(queryKey);
      utils.base.getRows.setInfiniteData(queryKey, (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            rows: page.rows.map((row) =>
              row.id === rowId
                ? {
                    ...row,
                    data: {
                      ...(row.data ?? {}),
                      [columnId]: value,
                    },
                  }
                : row
            ),
          })),
        };
      });
      return { previous, queryKey, rowId, columnId };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous && context.queryKey) {
        utils.base.getRows.setInfiniteData(context.queryKey, context.previous);
      }
    },
    onSuccess: (_data, variables) => {
      setCellEdits((prev) => {
        const rowEdits = prev[variables.rowId];
        if (!rowEdits || !(variables.columnId in rowEdits)) {
          return prev;
        }
        const { [variables.columnId]: _removed, ...rest } = rowEdits;
        if (Object.keys(rest).length === 0) {
          const { [variables.rowId]: _rowRemoved, ...next } = prev;
          return next;
        }
        return { ...prev, [variables.rowId]: rest };
      });
    },
  });

  useEffect(() => {
    setActiveTableId(null);
    setEnsuredTableId(null);
    setHoveredRowId(null);
    setHoveredHeaderId(null);
    setSelectedCell(null);
  }, [baseId]);

  useEffect(() => {
    const tables = baseDetailsQuery.data?.tables ?? [];
    if (!tables.length) return;
    if (activeTableId && tables.some((table) => table.id === activeTableId)) {
      return;
    }
    const firstTable = tables[0];
    if (!firstTable) return;
    setActiveTableId(firstTable.id);
  }, [activeTableId, baseDetailsQuery.data?.tables]);

  useEffect(() => {
    if (!activeTableId) return;
    parentRef.current?.scrollTo({ top: 0 });
  }, [activeTableId]);

  useEffect(() => {
    setCellEdits({});
  }, [activeTableId]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("scroll", handleClick, true);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("scroll", handleClick, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  const activeTables = baseDetailsQuery.data?.tables ?? [];
  const activeTable = tableMetaQuery.data?.table ?? null;
  const activeColumns = tableMetaQuery.data?.columns ?? [];
  const activeRowCount = tableMetaQuery.data?.rowCount ?? 0;
  const canDeleteTable = activeTables.length > 1;
  const canDeleteColumn = activeColumns.length > 1;
  const canDeleteRow = activeRowCount > 1;
  const showContextMenu =
    contextMenu &&
    ((contextMenu.type === "table" && canDeleteTable) ||
      (contextMenu.type === "column" && canDeleteColumn) ||
      (contextMenu.type === "row" && canDeleteRow));

  useEffect(() => {
    if (!activeColumns.length || !activeTableId) return;
    if (ensuredTableId === activeTableId) return;
    const missing = REQUIRED_COLUMNS.filter(
      (name) => !activeColumns.some((column) => column.name === name)
    );
    if (missing.length === 0) {
      setEnsuredTableId(activeTableId);
      return;
    }
    missing.forEach((name) => {
      addColumn.mutate({ tableId: activeTableId, name });
    });
    setEnsuredTableId(activeTableId);
  }, [activeColumns, activeTableId, addColumn, ensuredTableId]);

  useEffect(() => {
    if (!activeColumns.length) return;
    setColumnWidths((prev) => {
      const next = { ...prev };
      activeColumns.forEach((column) => {
        if (!next[column.id]) {
          next[column.id] = DEFAULT_COLUMN_WIDTH;
        }
      });
      Object.keys(next).forEach((columnId) => {
        if (!activeColumns.some((column) => column.id === columnId)) {
          delete next[columnId];
        }
      });
      return next;
    });
  }, [activeColumns]);

  useEffect(() => {
    if (!resizing) return;
    const handleMove = (event: MouseEvent) => {
      const delta = event.clientX - resizing.startX;
      const nextWidth = Math.min(
        MAX_COLUMN_WIDTH,
        Math.max(MIN_COLUMN_WIDTH, resizing.startWidth + delta)
      );
      setColumnWidths((prev) => ({
        ...prev,
        [resizing.columnId]: nextWidth,
      }));
    };
    const handleUp = () => setResizing(null);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [resizing]);

  const rows = useMemo(() => {
    const pages = rowsQuery.data?.pages ?? [];
    const seen = new Map<string, (typeof pages)[number]["rows"][number]>();
    const ordered: (typeof pages)[number]["rows"][number][] = [];
    pages.forEach((page) => {
      page.rows.forEach((row) => {
        if (!seen.has(row.id)) {
          seen.set(row.id, row);
          ordered.push(row);
        }
      });
    });
    return ordered;
  }, [rowsQuery.data?.pages]);

  const columnOrder = useMemo(
    () => activeColumns.map((column) => column.id),
    [activeColumns]
  );

  const tableData = useMemo<TableRow[]>(() => {
    if (!activeTable) return [];
    return rows.map((row) => {
      const data = row.data ?? {};
      const cells = Object.fromEntries(
        activeColumns.map((column) => [column.id, data[column.id] ?? ""])
      );
      return { id: row.id, ...cells };
    });
  }, [activeColumns, activeTable, rows]);

  const rowOrder = useMemo(() => tableData.map((row) => row.id), [tableData]);

  const columnsWithAdd = useMemo(
    () => [
      ...activeColumns.map((column) => ({
        id: column.id,
        name: column.name,
        width: columnWidths[column.id] ?? DEFAULT_COLUMN_WIDTH,
        type: "data" as const,
      })),
      {
        id: "__add__",
        name: "Add column",
        width: ADD_COLUMN_WIDTH,
        type: "add" as const,
      },
    ],
    [activeColumns, columnWidths]
  );

  const totalColumnsWidth = useMemo(
    () => columnsWithAdd.reduce((sum, column) => sum + column.width, 0),
    [columnsWithAdd]
  );
  const addColumnWidth = useMemo(
    () => columnsWithAdd.find((column) => column.type === "add")?.width ?? ADD_COLUMN_WIDTH,
    [columnsWithAdd]
  );
  const dataColumnsWidth = Math.max(0, totalColumnsWidth - addColumnWidth);

  const rowCount = tableData.length;

  const rowVirtualizer = useVirtualizer({
    count: rowsQuery.hasNextPage ? rowCount + 1 : rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: columnsWithAdd.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => columnsWithAdd[index]?.width ?? DEFAULT_COLUMN_WIDTH,
    overscan: 2,
    getItemKey: (index) => columnsWithAdd[index]?.id ?? index,
  });

  const virtualColumns = columnVirtualizer.getVirtualItems();
  const nameColumnIndex = columnsWithAdd.findIndex(
    (column) => column.type === "data" && column.name === "Name"
  );
  const nameColumn = nameColumnIndex >= 0 ? columnsWithAdd[nameColumnIndex] : null;
  const nameColumnWidth = nameColumn?.width ?? 0;
  const scrollableVirtualColumns = nameColumn
    ? virtualColumns.filter((virtualColumn) => virtualColumn.index !== nameColumnIndex)
    : virtualColumns;
  const scrollablePaddingLeft = nameColumn
    ? Math.max(0, (scrollableVirtualColumns[0]?.start ?? nameColumnWidth) - nameColumnWidth)
    : virtualColumns[0]?.start ?? 0;
  const totalScrollableWidth = Math.max(0, totalColumnsWidth - nameColumnWidth);
  const lastScrollableEnd = nameColumn
    ? Math.max(
        0,
        (scrollableVirtualColumns.at(-1)?.end ?? nameColumnWidth) - nameColumnWidth
      )
    : virtualColumns.at(-1)?.end ?? 0;
  const scrollablePaddingRight = Math.max(0, totalScrollableWidth - lastScrollableEnd);

  useEffect(() => {
    columnVirtualizer.measure();
  }, [columnVirtualizer, columnWidths, columnsWithAdd.length]);

  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;
    if (
      lastItem.index >= rowCount - 1 &&
      rowsQuery.hasNextPage &&
      !rowsQuery.isFetchingNextPage
    ) {
      rowsQuery.fetchNextPage();
    }
  }, [rowCount, rowsQuery, rowsQuery.hasNextPage, rowsQuery.isFetchingNextPage, virtualItems]);

  const handleAddTable = () => {
    addTable.mutate({ baseId });
  };

  const handleSelectTable = (tableId: string) => {
    setActiveTableId(tableId);
  };

  const handleDeleteTable = (tableId: string) => {
    deleteTable.mutate({ tableId });
    setContextMenu(null);
  };

  const handleDeleteColumn = (columnId: string) => {
    deleteColumn.mutate({ columnId });
    setContextMenu(null);
  };

  const handleAddColumn = () => {
    if (!activeTableId) return;
    addColumn.mutate({ tableId: activeTableId });
  };

  const handleAddRow = () => {
    if (!activeTableId) return;
    addRows.mutate({ tableId: activeTableId, count: 1 });
  };

  const handleAddBulkRows = () => {
    if (!activeTableId) return;
    addRows.mutate({ tableId: activeTableId, count: BULK_ROWS });
  };

  const handleDeleteRow = (rowId: string) => {
    deleteRow.mutate({ rowId });
    setContextMenu(null);
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    router.refresh();
  };

  const handleOpenContextMenu = (
    event: ReactMouseEvent,
    type: "table" | "column" | "row",
    id: string,
    allowed: boolean
  ) => {
    event.preventDefault();
    if (!allowed) {
      setContextMenu(null);
      return;
    }
    setContextMenu({ type, id, x: event.clientX, y: event.clientY });
  };

  const handleStartResize = (event: ReactMouseEvent, columnId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setResizing({
      columnId,
      startX: event.clientX,
      startWidth: columnWidths[columnId] ?? DEFAULT_COLUMN_WIDTH,
    });
  };

  const handleCellChange = (rowId: string, columnId: string, value: string) => {
    setCellEdits((prev) => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [columnId]: value,
      },
    }));
  };

  const handleCellCommit = (
    rowId: string,
    columnId: string,
    value: string,
    originalValue: string
  ) => {
    if (value === originalValue) {
      setCellEdits((prev) => {
        const rowEdits = prev[rowId];
        if (!rowEdits || !(columnId in rowEdits)) return prev;
        const { [columnId]: _removed, ...rest } = rowEdits;
        if (Object.keys(rest).length === 0) {
          const { [rowId]: _rowRemoved, ...next } = prev;
          return next;
        }
        return { ...prev, [rowId]: rest };
      });
      return;
    }
    updateCell.mutate({ rowId, columnId, value });
  };

  const focusCell = (rowId: string, columnId: string) => {
    const rowIndex = rowOrder.indexOf(rowId);
    const colIndex = columnOrder.indexOf(columnId);
    if (rowIndex >= 0) {
      rowVirtualizer.scrollToIndex(rowIndex);
    }
    if (colIndex >= 0) {
      columnVirtualizer.scrollToIndex(colIndex);
    }
    requestAnimationFrame(() => {
      const key = `${rowId}-${columnId}`;
      const node = cellRefs.current.get(key);
      if (node) {
        node.focus();
        node.select();
      }
    });
    setSelectedCell({ rowId, columnId });
  };

  const handleCellKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement>,
    rowId: string,
    columnId: string
  ) => {
    if (columnOrder.length === 0 || rowOrder.length === 0) return;
    const rowIndex = rowOrder.indexOf(rowId);
    const colIndex = columnOrder.indexOf(columnId);
    if (rowIndex === -1 || colIndex === -1) return;

    let nextRow = rowIndex;
    let nextCol = colIndex;

    if (event.key === "ArrowRight") {
      nextCol = Math.min(columnOrder.length - 1, colIndex + 1);
    } else if (event.key === "ArrowLeft") {
      nextCol = Math.max(0, colIndex - 1);
    } else if (event.key === "ArrowDown") {
      nextRow = Math.min(rowOrder.length - 1, rowIndex + 1);
    } else if (event.key === "ArrowUp") {
      nextRow = Math.max(0, rowIndex - 1);
    } else if (event.key === "Tab") {
      if (event.shiftKey) {
        if (colIndex > 0) {
          nextCol = colIndex - 1;
        } else if (rowIndex > 0) {
          nextRow = rowIndex - 1;
          nextCol = columnOrder.length - 1;
        }
      } else if (colIndex < columnOrder.length - 1) {
        nextCol = colIndex + 1;
      } else if (rowIndex < rowOrder.length - 1) {
        nextRow = rowIndex + 1;
        nextCol = 0;
      }
    } else {
      return;
    }

    event.preventDefault();
    focusCell(rowOrder[nextRow]!, columnOrder[nextCol]!);
  };

  const bulkRowsDisabled =
    !activeTableId ||
    addRows.isPending ||
    activeRowCount + BULK_ROWS > MAX_ROWS;
  const addRowDisabled =
    !activeTableId || addRows.isPending || activeRowCount >= MAX_ROWS;

  const baseName = baseDetailsQuery.data?.name ?? "Base";
  const userInitial = formatUserInitial(userName);

  const headerCellBorder = (
    column: { name: string; type: "data" | "add" },
    isFirst: boolean
  ) => ({
    borderTop: "none",
    borderBottom: "0.5px solid #CBCBCB",
    borderRight:
      column.type === "data" && column.name === "Name"
        ? "none"
        : "0.5px solid #DDE1E3",
    borderLeft: "none",
  });

  const bodyCellBorder = (
    column: { name: string; type: "data" | "add" },
    isFirst: boolean,
    isLastRow: boolean
  ) => ({
    borderBottom: isLastRow ? "none" : "0.5px solid #DDE1E3",
    borderRight:
      column.type === "data" && column.name === "Name"
        ? "none"
        : "0.5px solid #DDE1E3",
    borderLeft: "none",
  });

  return (
    <div className={clsx("h-screen overflow-hidden bg-white text-[#1d1f24]", inter.className)}>
      <div className="flex h-screen overflow-hidden">
        <aside className="relative flex w-[56px] flex-shrink-0 flex-col items-center border-r border-[#E5E5E5] bg-white py-4">
          <img
            alt="Airtable"
            className="h-[19.74px] w-[22.68px]"
            src={logoIcon.src}
            style={{ filter: "brightness(0) saturate(100%)" }}
          />
          <img
            alt=""
            className="mt-[25px] h-[28.31px] w-[28.33px]"
            src={omniIcon.src}
          />
          <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-4">
            <img alt="" className="h-[15px] w-[15px]" src={helpIcon.src} />
            <img alt="" className="h-[16px] w-[16px]" src={bellIcon.src} />
            <button
              type="button"
              onClick={handleSignOut}
              className="airtable-circle relative overflow-hidden"
              aria-label="Sign out"
            >
              <img
                alt=""
                className="absolute inset-0 m-auto h-[29px] w-[29px]"
                src={imgEllipse2}
              />
              <img
                alt=""
                className="absolute inset-0 m-auto h-[26px] w-[26px]"
                src={imgEllipse3}
              />
              <span className="relative text-[13px] text-white">{userInitial}</span>
            </button>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="border-b border-[#DDE1E3] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-[32px] w-[32px] items-center justify-center rounded-[6px] bg-[#8c3f78]">
                  <img
                    alt=""
                    className="h-[19.74px] w-[22.68px]"
                    src={logoIcon.src}
                    style={{ filter: "brightness(0) saturate(100%) invert(1)" }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/bases")}
                  className="flex items-center gap-2 text-[16px] font-semibold text-[#1d1f24]"
                >
                  <span>{baseName}</span>
                  <span className="airtable-nav-chevron rotate-90 text-[#1d1f24]" />
                </button>
              </div>

              <nav className="ml-[118px] flex flex-wrap items-center gap-5 text-[13px] font-medium text-[#616670]">
                <button type="button" className="relative text-[#1d1f24]">
                  Data
                  <span className="absolute -bottom-[19px] left-1/2 h-[2px] w-[28.5px] -translate-x-1/2 bg-[#8c3f78]" />
                </button>
                <button type="button">Automations</button>
                <button type="button">Interfaces</button>
                <button type="button">Forms</button>
              </nav>

              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="flex items-center" aria-label="Refresh">
                  <img alt="" className="h-[14px] w-[14px]" src={refreshIcon.src} />
                </button>
                <button
                  type="button"
                  className="flex h-[32px] w-[126px] items-center justify-center rounded-[6px] bg-[#F2F2F2] text-[13px] text-[#1d1f24]"
                >
                  Trial: 14 days left
                </button>
                <button
                  type="button"
                  className="flex h-[32px] items-center gap-2 rounded-[6px] border border-[#DDE1E3] bg-white px-3 text-[13px] text-[#1d1f24]"
                >
                  <img alt="" className="h-[14px] w-[14px]" src={launchIcon.src} />
                  Launch
                </button>
                <button
                  type="button"
                  className="h-[32px] rounded-[6px] bg-[#8c3f78] px-4 text-[13px] font-medium text-white"
                >
                  Share
                </button>
              </div>
            </div>
          </header>

          <section className="border-b border-[#DDE1E3] bg-white px-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                {activeTables.map((tableItem) => (
                  <button
                    key={tableItem.id}
                    type="button"
                    onClick={() => handleSelectTable(tableItem.id)}
                    onContextMenu={(event) =>
                      handleOpenContextMenu(event, "table", tableItem.id, canDeleteTable)
                    }
                    className={clsx(
                      "flex items-center gap-2 rounded-[6px] border px-3 py-1 text-[13px]",
                      tableItem.id === activeTableId
                        ? "border-[#1d1f24] text-[#1d1f24]"
                        : "border-[#DDE1E3] text-[#616670]"
                    )}
                  >
                    {tableItem.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleAddTable}
                  disabled={activeTables.length >= MAX_TABLES || addTable.isPending}
                  className={clsx(
                    "rounded-[6px] border px-3 py-1 text-[13px]",
                    activeTables.length >= MAX_TABLES
                      ? "cursor-not-allowed border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8]"
                      : "border-[#DDE1E3] text-[#1d1f24]"
                  )}
                >
                  {addTable.isPending ? "Adding..." : "+ Add table"}
                </button>
              </div>
              <button type="button" className="flex items-center gap-2 text-[13px] text-[#595459]">
                Tools
                <span className="airtable-nav-chevron rotate-90 text-[#595459]" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 pb-0 text-[13px] text-[#616670]">
              <button type="button" className="flex items-center gap-2">
                <img alt="" className="h-[14px] w-[14px]" src={gridViewIcon.src} />
                Grid view
              </button>
              <div className="ml-auto flex flex-wrap items-center gap-4">
                <button type="button" className="flex items-center gap-2">
                  <img alt="" className="h-[14px] w-[14px]" src={hideFieldsIcon.src} />
                  Hide fields
                </button>
                <button type="button" className="flex items-center gap-2">
                  <img alt="" className="h-[14px] w-[14px]" src={filterIcon.src} />
                  Filter
                </button>
                <button type="button" className="flex items-center gap-2">
                  <img alt="" className="h-[14px] w-[14px]" src={groupIcon.src} />
                  Group
                </button>
                <button type="button" className="flex items-center gap-2">
                  <img alt="" className="h-[14px] w-[14px]" src={sortIcon.src} />
                  Sort
                </button>
                <button type="button" className="flex items-center gap-2">
                  <img alt="" className="h-[14px] w-[14px]" src={colourIcon.src} />
                  Colour
                </button>
                <button type="button" className="flex items-center" aria-label="Row height">
                  <img alt="" className="h-[14px] w-[14px]" src={rowHeightIcon.src} />
                </button>
                <button type="button" className="flex items-center gap-2">
                  <img alt="" className="h-[14px] w-[14px]" src={shareSyncIcon.src} />
                  Share and sync
                </button>
                <button
                  type="button"
                  onClick={handleAddBulkRows}
                  disabled={bulkRowsDisabled}
                  className={clsx(
                    "rounded-[6px] border px-3 py-1 text-[13px]",
                    bulkRowsDisabled
                      ? "cursor-not-allowed border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8]"
                      : "border-[#DDE1E3] text-[#1d1f24]"
                  )}
                >
                  Add 100k rows
                </button>
              </div>
            </div>
          </section>

          <div className="flex min-h-0 flex-1 overflow-hidden">
            <section className="w-[281px] flex-shrink-0 border-r border-[#DDE1E3] bg-white" />

            <section className="min-h-0 min-w-0 flex-1 overflow-hidden bg-[#F7F8FC]">
              {baseDetailsQuery.isLoading && (
                <div className="rounded-[6px] border border-[#DDE1E3] bg-white px-4 py-6 text-[13px] text-[#616670]">
                  Loading base...
                </div>
              )}

              {baseDetailsQuery.isError && (
                <div className="rounded-[6px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-6 text-[12px] text-[#991b1b]">
                  We couldn’t load this base. It may have been deleted or you may not have access.
                </div>
              )}

              {activeTable && (
                <div className="h-full">
                  <div className="relative h-full w-full">
                    <div
                      ref={parentRef}
                      className="h-full w-full overflow-auto"
                      style={{ backgroundColor: "#F7F8FC" }}
                    >
                      <div
                        className="relative"
                        style={{ minWidth: totalColumnsWidth, minHeight: "100%" }}
                        onMouseLeave={() => {
                          setHoveredRowId(null);
                          setHoveredHeaderId(null);
                        }}
                      >
                      <div
                        className="sticky top-0 z-10 flex text-[13px] font-medium text-[#1d1f24] relative"
                        style={{ width: totalColumnsWidth }}
                      >
                        {nameColumn && (
                          <div
                            className="relative flex h-[33px] items-center gap-2 px-2"
                            style={{
                              ...headerCellBorder(nameColumn, true),
                              width: nameColumnWidth,
                              minWidth: nameColumnWidth,
                              maxWidth: nameColumnWidth,
                              flex: "0 0 auto",
                              backgroundColor:
                                hoveredHeaderId === nameColumn.id
                                  ? "var(--airtable-hover-bg)"
                                  : "#ffffff",
                              position: "sticky",
                              left: 0,
                              zIndex: 30,
                            }}
                            onMouseEnter={() => setHoveredHeaderId(nameColumn.id)}
                            onMouseLeave={() => setHoveredHeaderId(null)}
                            onContextMenu={(event) =>
                              handleOpenContextMenu(
                                event,
                                "column",
                                nameColumn.id,
                                canDeleteColumn
                              )
                            }
                          >
                            {columnIconMap[nameColumn.name] && (
                              <img
                                alt=""
                                className="h-[13px] w-[13px]"
                                src={columnIconMap[nameColumn.name]}
                              />
                            )}
                            <span>{nameColumn.name}</span>
                            <div
                              role="separator"
                              aria-label="Resize column"
                              className="absolute right-0 top-0 h-full w-[6px] cursor-col-resize"
                              onMouseDown={(event) =>
                                handleStartResize(event, nameColumn.id)
                              }
                            />
                          </div>
                        )}
                        {scrollablePaddingLeft > 0 && (
                          <div style={{ width: scrollablePaddingLeft }} />
                        )}
                        {scrollableVirtualColumns.map((virtualColumn) => {
                          const column = columnsWithAdd[virtualColumn.index];
                          if (!column) return null;
                          const cellStyle = headerCellBorder(column, false);
                          const backgroundColor =
                            hoveredHeaderId === column.id
                              ? "var(--airtable-hover-bg)"
                              : "#ffffff";

                          if (column.type === "add") {
                            return (
                              <button
                                key={column.id}
                                type="button"
                                onClick={handleAddColumn}
                                onMouseEnter={() => setHoveredHeaderId(column.id)}
                                onMouseLeave={() => setHoveredHeaderId(null)}
                                disabled={
                                  activeColumns.length >= MAX_COLUMNS || addColumn.isPending
                                }
                                className="flex h-[33px] cursor-pointer items-center justify-center text-[#616670] transition-colors disabled:cursor-not-allowed"
                                style={{
                                  ...cellStyle,
                                  width: virtualColumn.size,
                                  flex: "0 0 auto",
                                  backgroundColor,
                                }}
                                aria-label="Add column"
                              >
                                <span className="airtable-plus-icon" aria-hidden="true" />
                              </button>
                            );
                          }

                          return (
                            <div
                              key={column.id}
                              className="relative flex h-[33px] items-center gap-2 px-2"
                              style={{
                                ...cellStyle,
                                width: virtualColumn.size,
                                flex: "0 0 auto",
                                backgroundColor,
                              }}
                              onMouseEnter={() => setHoveredHeaderId(column.id)}
                              onMouseLeave={() => setHoveredHeaderId(null)}
                              onContextMenu={(event) =>
                                handleOpenContextMenu(
                                  event,
                                  "column",
                                  column.id,
                                  canDeleteColumn
                                )
                              }
                            >
                              {columnIconMap[column.name] && (
                                <img
                                  alt=""
                                  className="h-[13px] w-[13px]"
                                  src={columnIconMap[column.name]}
                                />
                              )}
                              <span>{column.name}</span>
                              <div
                                role="separator"
                                aria-label="Resize column"
                                className="absolute right-0 top-0 h-full w-[6px] cursor-col-resize"
                                onMouseDown={(event) =>
                                  handleStartResize(event, column.id)
                                }
                              />
                            </div>
                          );
                        })}
                        {scrollablePaddingRight > 0 && (
                          <div style={{ width: scrollablePaddingRight }} />
                        )}
                        <div
                          className="pointer-events-none absolute bottom-0 left-0 right-0 z-40 h-px bg-[#CBCBCB]"
                          aria-hidden="true"
                        />
                      </div>

                      <div
                        className="relative"
                        style={{ height: rowVirtualizer.getTotalSize() }}
                      >
                        {virtualItems.map((virtualRow) => {
                          const row = tableData[virtualRow.index];
                          if (!row) {
                            return (
                              <div
                                key={`loader-${virtualRow.index}`}
                                className="absolute left-0 right-0 flex items-center px-3 text-[12px] text-[#616670]"
                                style={{
                                  transform: `translateY(${virtualRow.start}px)`,
                                  height: `${virtualRow.size}px`,
                                  width: totalColumnsWidth,
                                }}
                              >
                                {rowsQuery.hasNextPage
                                  ? "Loading more rows..."
                                  : "No more rows"}
                              </div>
                            );
                          }

                        const isLastRow = virtualRow.index === rowCount - 1;
                        const rowHasSelection = selectedCell?.rowId === row.id;

                        return (
                          <div
                            key={row.id}
                            className="absolute left-0 right-0 flex text-[13px] text-[#1d1f24]"
                            style={{
                              transform: `translateY(${virtualRow.start}px)`,
                              height: `${virtualRow.size}px`,
                              width: totalColumnsWidth,
                              zIndex: rowHasSelection ? 5 : 1,
                            }}
                            onMouseEnter={() => setHoveredRowId(row.id)}
                            onMouseLeave={() => setHoveredRowId(null)}
                            onContextMenu={(event) =>
                              handleOpenContextMenu(
                                event,
                                "row",
                                row.id,
                                canDeleteRow
                              )
                            }
                          >
                            {nameColumn && (
                              <div
                                className="relative flex h-[33px] items-center px-2 overflow-visible"
                                style={{
                                  ...bodyCellBorder(nameColumn, true, isLastRow),
                                  width: nameColumnWidth,
                                  minWidth: nameColumnWidth,
                                  maxWidth: nameColumnWidth,
                                  flex: "0 0 auto",
                                  backgroundColor:
                                    selectedCell?.rowId === row.id &&
                                    selectedCell?.columnId === nameColumn.id
                                      ? "#ffffff"
                                      : hoveredRowId === row.id
                                      ? "var(--airtable-hover-bg)"
                                      : selectedCell?.rowId === row.id
                                      ? "var(--airtable-hover-bg)"
                                      : "#ffffff",
                                  position: "sticky",
                                  left: 0,
                                  zIndex: 25,
                                }}
                              >
                                <input
                                  value={
                                    cellEdits[row.id]?.[nameColumn.id] ??
                                    row[nameColumn.id] ??
                                    ""
                                  }
                                  onChange={(event) =>
                                    handleCellChange(
                                      row.id,
                                      nameColumn.id,
                                      event.target.value
                                    )
                                  }
                                  onBlur={() =>
                                    handleCellCommit(
                                      row.id,
                                      nameColumn.id,
                                      cellEdits[row.id]?.[nameColumn.id] ??
                                        (row[nameColumn.id] ?? ""),
                                      row[nameColumn.id] ?? ""
                                    )
                                  }
                                  onFocus={() =>
                                    setSelectedCell({
                                      rowId: row.id,
                                      columnId: nameColumn.id,
                                    })
                                  }
                                  onClick={() =>
                                    setSelectedCell({
                                      rowId: row.id,
                                      columnId: nameColumn.id,
                                    })
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.currentTarget.blur();
                                      return;
                                    }
                                    handleCellKeyDown(event, row.id, nameColumn.id);
                                  }}
                                  ref={(node) => {
                                    const key = `${row.id}-${nameColumn.id}`;
                                    if (node) {
                                      cellRefs.current.set(key, node);
                                    } else {
                                      cellRefs.current.delete(key);
                                    }
                                  }}
                                  className="h-full w-full bg-transparent text-[13px] text-[#1d1f24] outline-none"
                                  aria-label={`${nameColumn.name} cell`}
                                />
                                {selectedCell?.rowId === row.id &&
                                  selectedCell?.columnId === nameColumn.id && (
                                    <>
                                      <div className="pointer-events-none absolute -inset-[1px] z-10 rounded-[2px] border-2 border-[#156FE2]" />
                                      <div className="pointer-events-none absolute bottom-0 right-0 z-20 h-[8px] w-[8px] translate-x-1/2 translate-y-1/2 rounded-[1px] border border-[#156FE2] bg-white" />
                                    </>
                                  )}
                              </div>
                            )}
                            {scrollablePaddingLeft > 0 && (
                              <div style={{ width: scrollablePaddingLeft }} />
                            )}
                            {scrollableVirtualColumns.map((virtualColumn) => {
                              const column = columnsWithAdd[virtualColumn.index];
                              if (!column) return null;
                              const isSelected =
                                column.type === "data" &&
                                selectedCell?.rowId === row.id &&
                                selectedCell?.columnId === column.id;
                              const isRowHovered = hoveredRowId === row.id;
                              const rowHasSelection = selectedCell?.rowId === row.id;
                              const cellBackground = isSelected
                                ? "#ffffff"
                                : isRowHovered || rowHasSelection
                                ? "var(--airtable-hover-bg)"
                                : "#ffffff";
                              const cellStyle = bodyCellBorder(column, false, isLastRow);

                                if (column.type === "add") {
                                  return (
                                    <div
                                      key={`${row.id}-${column.id}`}
                                      style={{
                                        width: virtualColumn.size,
                                        flex: "0 0 auto",
                                      }}
                                      aria-hidden="true"
                                    />
                                  );
                                }

                                const originalValue = row[column.id] ?? "";
                                const editedValue =
                                  cellEdits[row.id]?.[column.id] ?? originalValue;

                                return (
                                <div
                                  key={`${row.id}-${column.id}`}
                                  className="relative flex h-[33px] items-center px-2 overflow-visible"
                                  style={{
                                    ...cellStyle,
                                    width: virtualColumn.size,
                                    flex: "0 0 auto",
                                    backgroundColor: cellBackground,
                                    }}
                                  >
                                    <input
                                      value={editedValue}
                                      onChange={(event) =>
                                        handleCellChange(
                                          row.id,
                                          column.id,
                                          event.target.value
                                        )
                                      }
                                      onBlur={() =>
                                        handleCellCommit(
                                          row.id,
                                          column.id,
                                          editedValue,
                                          originalValue
                                        )
                                      }
                                      onFocus={() =>
                                        setSelectedCell({
                                          rowId: row.id,
                                          columnId: column.id,
                                        })
                                      }
                                      onClick={() =>
                                        setSelectedCell({
                                          rowId: row.id,
                                          columnId: column.id,
                                        })
                                      }
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          event.currentTarget.blur();
                                          return;
                                        }
                                        handleCellKeyDown(event, row.id, column.id);
                                      }}
                                      ref={(node) => {
                                        const key = `${row.id}-${column.id}`;
                                        if (node) {
                                          cellRefs.current.set(key, node);
                                        } else {
                                          cellRefs.current.delete(key);
                                        }
                                      }}
                                      className="h-full w-full bg-transparent text-[13px] text-[#1d1f24] outline-none"
                                      aria-label={`${column.name} cell`}
                                    />
                                    {isSelected && (
                                      <>
                                        <div className="pointer-events-none absolute -inset-[1px] z-10 rounded-[2px] border-2 border-[#156FE2]" />
                                        <div className="pointer-events-none absolute bottom-0 right-0 z-20 h-[8px] w-[8px] translate-x-1/2 translate-y-1/2 rounded-[1px] border border-[#156FE2] bg-white" />
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            {scrollablePaddingRight > 0 && (
                              <div style={{ width: scrollablePaddingRight }} />
                            )}
                          </div>
                        );
                      })}
                      </div>

                      <div className="flex" style={{ width: totalColumnsWidth }}>
                        <button
                          type="button"
                          onClick={handleAddRow}
                          disabled={addRowDisabled}
                          className="flex h-[33px] cursor-pointer items-center px-2 text-[#616670] disabled:cursor-not-allowed"
                          style={{
                            width: dataColumnsWidth,
                            backgroundColor: addRowHover
                              ? "var(--airtable-hover-bg)"
                              : "#ffffff",
                            borderTop: "0.5px solid #DDE1E3",
                            borderBottom: "0.5px solid #DDE1E3",
                          borderLeft: "none",
                            borderRight: "0.5px solid #DDE1E3",
                          }}
                          onMouseEnter={() => setAddRowHover(true)}
                          onMouseLeave={() => setAddRowHover(false)}
                          aria-label="Add row"
                        >
                          <span className="airtable-plus-icon" aria-hidden="true" />
                        </button>
                        <div style={{ width: addColumnWidth }} aria-hidden="true" />
                      </div>
                    </div>
                    </div>
                    {nameColumn && nameColumnWidth > 0 && (
                      <div
                        className="pointer-events-none absolute top-0 bottom-0 z-40 w-px bg-[#CBCBCB]"
                        style={{ left: `${nameColumnWidth}px` }}
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  {!activeColumns.length && (
                    <div className="p-6 text-center text-[12px] text-[#94a3b8]">
                      Add a column to start building this table.
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {showContextMenu && contextMenu && (
        <div
          className="fixed z-50 min-w-[160px] rounded-[10px] border border-[#e2e8f0] bg-white p-1 text-[12px] shadow-[0_10px_30px_rgba(15,23,42,0.15)]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(event) => event.stopPropagation()}
        >
          {contextMenu.type === "table" && canDeleteTable && (
            <button
              type="button"
              onClick={() => handleDeleteTable(contextMenu.id)}
              className="w-full rounded-[8px] px-3 py-2 text-left text-[#dc2626] hover:bg-[#fee2e2]"
            >
              Delete table
            </button>
          )}
          {contextMenu.type === "column" && canDeleteColumn && (
            <button
              type="button"
              onClick={() => handleDeleteColumn(contextMenu.id)}
              className="w-full rounded-[8px] px-3 py-2 text-left text-[#dc2626] hover:bg-[#fee2e2]"
            >
              Delete column
            </button>
          )}
          {contextMenu.type === "row" && canDeleteRow && (
            <button
              type="button"
              onClick={() => handleDeleteRow(contextMenu.id)}
              className="w-full rounded-[8px] px-3 py-2 text-left text-[#dc2626] hover:bg-[#fee2e2]"
            >
              Delete row
            </button>
          )}
        </div>
      )}
    </div>
  );
}
