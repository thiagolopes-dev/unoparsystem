"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface FloatingPositionInput {
  anchorRect: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
  };
  panelHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  align?: "left" | "right";
  matchAnchorWidth?: boolean;
  minWidth?: number;
  fixedWidth?: number;
  offset?: number;
  padding?: number;
}

export interface FloatingPositionResult {
  left: number;
  width: number;
  placement: "bottom" | "top";
  top?: number;
  bottom?: number;
}

export function computeFloatingPosition({
  anchorRect,
  panelHeight,
  viewportWidth,
  viewportHeight,
  align = "left",
  matchAnchorWidth = false,
  minWidth,
  fixedWidth,
  offset = 6,
  padding = 8,
}: FloatingPositionInput): FloatingPositionResult {
  const maxAvailableWidth = Math.max(0, viewportWidth - padding * 2);
  const desiredWidth =
    fixedWidth ??
    (matchAnchorWidth
      ? Math.max(anchorRect.width, minWidth ?? 0)
      : minWidth ?? anchorRect.width);
  const width = Math.min(desiredWidth, maxAvailableWidth);

  const rawLeft =
    align === "right" ? anchorRect.right - width : anchorRect.left;
  const maxLeft = Math.max(padding, viewportWidth - width - padding);
  const left = Math.max(padding, Math.min(rawLeft, maxLeft));

  const spaceBelow = Math.max(0, viewportHeight - anchorRect.bottom - offset - padding);
  const spaceAbove = Math.max(0, anchorRect.top - offset - padding);

  if (panelHeight > spaceBelow && spaceAbove > spaceBelow) {
    return {
      left,
      width,
      placement: "top",
      bottom: Math.max(padding, viewportHeight - anchorRect.top + offset),
    };
  }

  return {
    left,
    width,
    placement: "bottom",
    top: Math.max(padding, anchorRect.bottom + offset),
  };
}

interface FloatingPanelProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  panelRef?: React.RefObject<HTMLDivElement | null>;
  align?: "left" | "right";
  matchAnchorWidth?: boolean;
  minWidth?: number;
  fixedWidth?: number;
  offset?: number;
  id?: string;
  role?: React.AriaRole;
  className?: string;
  children: React.ReactNode;
}

export function FloatingPanel({
  open,
  anchorRef,
  panelRef,
  align = "left",
  matchAnchorWidth = false,
  minWidth,
  fixedWidth,
  offset = 6,
  id,
  role,
  className = "",
  children,
}: FloatingPanelProps) {
  const internalRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<FloatingPositionResult | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    function updatePosition() {
      const anchor = anchorRef.current;
      const panel = internalRef.current;
      if (!anchor || !panel) return;

      const anchorRect = anchor.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();

      setPosition(
        computeFloatingPosition({
          anchorRect,
          panelHeight: panelRect.height,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          align,
          matchAnchorWidth,
          minWidth,
          fixedWidth,
          offset,
        })
      );
    }

    updatePosition();

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, anchorRef, align, matchAnchorWidth, minWidth, fixedWidth, offset]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={(node) => {
        internalRef.current = node;
        if (panelRef) {
          panelRef.current = node;
        }
      }}
      id={id}
      role={role}
      data-placement={position?.placement ?? "bottom"}
      style={{
        position: "fixed",
        left: position ? `${position.left}px` : "0px",
        width: position
          ? `${position.width}px`
          : fixedWidth
          ? `${fixedWidth}px`
          : minWidth
          ? `${minWidth}px`
          : undefined,
        top: position?.placement === "bottom" ? `${position.top}px` : undefined,
        bottom: position?.placement === "top" ? `${position.bottom}px` : undefined,
        visibility: position ? "visible" : "hidden",
      }}
      className={`z-[70] ${className}`}
    >
      {children}
    </div>,
    document.body
  );
}
