import { describe, expect, it } from "vitest";
import { computeFloatingPosition } from "@/components/ui/floating-panel";

describe("computeFloatingPosition", () => {
  it("posiciona abaixo alinhado à esquerda quando há espaço suficiente", () => {
    const result = computeFloatingPosition({
      anchorRect: { top: 200, bottom: 236, left: 320, right: 500, width: 180 },
      panelHeight: 220,
      viewportWidth: 1280,
      viewportHeight: 800,
      align: "left",
      matchAnchorWidth: true,
      minWidth: 220,
    });

    expect(result).toEqual({
      left: 320,
      width: 220,
      placement: "bottom",
      top: 242,
    });
  });

  it("alinha à direita respeitando a borda direita do trigger", () => {
    const result = computeFloatingPosition({
      anchorRect: { top: 200, bottom: 236, left: 960, right: 1136, width: 176 },
      panelHeight: 200,
      viewportWidth: 1280,
      viewportHeight: 800,
      align: "right",
      matchAnchorWidth: true,
      minWidth: 220,
    });

    expect(result).toEqual({
      left: 916,
      width: 220,
      placement: "bottom",
      top: 242,
    });
  });

  it("inverte para cima quando não há espaço abaixo mas há espaço acima", () => {
    const result = computeFloatingPosition({
      anchorRect: { top: 680, bottom: 716, left: 400, right: 580, width: 180 },
      panelHeight: 260,
      viewportWidth: 1280,
      viewportHeight: 800,
      align: "left",
      fixedWidth: 292,
    });

    expect(result).toEqual({
      left: 400,
      width: 292,
      placement: "top",
      bottom: 126,
    });
  });

  it("limita posição horizontal e largura dentro da viewport em telas estreitas", () => {
    const result = computeFloatingPosition({
      anchorRect: { top: 100, bottom: 136, left: 260, right: 350, width: 90 },
      panelHeight: 280,
      viewportWidth: 360,
      viewportHeight: 740,
      align: "left",
      fixedWidth: 292,
    });

    expect(result.left).toBe(60);
    expect(result.width).toBe(292);
    expect(result.placement).toBe("bottom");
    expect(result.top).toBe(142);
  });
});
