// src/index.ts
import { useRef, useCallback } from "react";
import html2canvas from "html2canvas";

// src/converter.ts
import jsPDF from "jspdf";

// src/constants.ts
var MM_TO_PX = 3.77952755906;
var Resolution = /* @__PURE__ */ ((Resolution2) => {
  Resolution2[Resolution2["LOW"] = 1] = "LOW";
  Resolution2[Resolution2["NORMAL"] = 2] = "NORMAL";
  Resolution2[Resolution2["MEDIUM"] = 3] = "MEDIUM";
  Resolution2[Resolution2["HIGH"] = 7] = "HIGH";
  Resolution2[Resolution2["EXTREME"] = 12] = "EXTREME";
  return Resolution2;
})(Resolution || {});
var Margin = /* @__PURE__ */ ((Margin2) => {
  Margin2[Margin2["NONE"] = 0] = "NONE";
  Margin2[Margin2["SMALL"] = 5] = "SMALL";
  Margin2[Margin2["MEDIUM"] = 10] = "MEDIUM";
  Margin2[Margin2["LARGE"] = 25] = "LARGE";
  return Margin2;
})(Margin || {});
var DEFAULT_OPTIONS = {
  method: "save",
  resolution: 3 /* MEDIUM */,
  page: {
    margin: 0 /* NONE */,
    format: "A4",
    orientation: "portrait"
  },
  canvas: {
    mimeType: "image/jpeg",
    qualityRatio: 1,
    useCORS: true,
    logging: false
  },
  overrides: {}
};

// src/converter.ts
var Converter = class {
  pdf;
  canvas;
  options;
  constructor(canvas, options) {
    this.canvas = canvas;
    this.options = options;
    this.pdf = new jsPDF({
      format: this.options.page.format,
      orientation: this.options.page.orientation,
      ...this.options.overrides?.pdf,
      unit: "mm"
    });
  }
  getMarginTopMM() {
    const margin = typeof this.options.page.margin === "object" ? this.options.page.margin.top : this.options.page.margin;
    return Number(margin);
  }
  getMarginLeftMM() {
    const margin = typeof this.options.page.margin === "object" ? this.options.page.margin.left : this.options.page.margin;
    return Number(margin);
  }
  getMarginRightMM() {
    const margin = typeof this.options.page.margin === "object" ? this.options.page.margin.right : this.options.page.margin;
    return Number(margin);
  }
  getMarginBottomMM() {
    const margin = typeof this.options.page.margin === "object" ? this.options.page.margin.bottom : this.options.page.margin;
    return Number(margin);
  }
  getMarginTop() {
    return this.getMarginTopMM() * MM_TO_PX;
  }
  getMarginBottom() {
    return this.getMarginBottomMM() * MM_TO_PX;
  }
  getMarginLeft() {
    return this.getMarginLeftMM() * MM_TO_PX;
  }
  getMarginRight() {
    return this.getMarginRightMM() * MM_TO_PX;
  }
  getScale() {
    return this.options.resolution;
  }
  getPageHeight() {
    return this.getPageHeightMM() * MM_TO_PX;
  }
  getPageHeightMM() {
    return this.pdf.internal.pageSize.height;
  }
  getPageWidthMM() {
    return this.pdf.internal.pageSize.width;
  }
  getPageWidth() {
    return this.getPageWidthMM() * MM_TO_PX;
  }
  getOriginalCanvasWidth() {
    return this.canvas.width / this.getScale();
  }
  getOriginalCanvasHeight() {
    return this.canvas.height / this.getScale();
  }
  getCanvasPageAvailableHeight() {
    return this.getPageAvailableHeight() * this.getScale() * this.getHorizontalFitFactor();
  }
  getPageAvailableWidth() {
    return this.getPageWidth() - (this.getMarginLeft() + this.getMarginRight());
  }
  getPageAvailableHeight() {
    return this.getPageHeight() - (this.getMarginTop() + this.getMarginBottom());
  }
  getPageAvailableWidthMM() {
    return this.getPageAvailableWidth() / MM_TO_PX;
  }
  getPageAvailableHeightMM() {
    return this.getPageAvailableHeight() / MM_TO_PX;
  }
  getNumberPages() {
    return Math.ceil(this.canvas.height / this.getCanvasPageAvailableHeight());
  }
  getHorizontalFitFactor() {
    if (this.getPageAvailableWidth() < this.getOriginalCanvasWidth()) {
      return this.getOriginalCanvasWidth() / this.getPageAvailableWidth();
    }
    return 1;
  }
  getCanvasOffsetY(pageNumber) {
    return this.getCanvasPageAvailableHeight() * (pageNumber - 1);
  }
  getCanvasHeightLeft(pageNumber) {
    return this.canvas.height - this.getCanvasOffsetY(pageNumber);
  }
  getCanvasPageHeight(pageNumber) {
    if (this.canvas.height < this.getCanvasPageAvailableHeight()) {
      return this.canvas.height;
    }
    const canvasHeightPending = this.getCanvasHeightLeft(pageNumber);
    return canvasHeightPending < this.getCanvasPageAvailableHeight() ? canvasHeightPending : this.getCanvasPageAvailableHeight();
  }
  getCanvasPageWidth() {
    return this.canvas.width;
  }
  createCanvasPage(pageNumber) {
    const canvasPageWidth = this.getCanvasPageWidth();
    const canvasPageHeight = this.getCanvasPageHeight(pageNumber);
    const canvasPage = document.createElement("canvas");
    canvasPage.setAttribute("width", String(canvasPageWidth));
    canvasPage.setAttribute("height", String(canvasPageHeight));
    const ctx = canvasPage.getContext("2d");
    ctx.drawImage(
      this.canvas,
      0,
      this.getCanvasOffsetY(pageNumber),
      this.canvas.width,
      canvasPageHeight,
      0,
      0,
      this.canvas.width,
      canvasPageHeight
    );
    return canvasPage;
  }
  convert() {
    let pageNumber = 1;
    const numberPages = this.getNumberPages();
    while (pageNumber <= numberPages) {
      if (pageNumber > 1) {
        this.pdf.addPage(
          this.options.page.format,
          this.options.page.orientation
        );
      }
      const canvasPage = this.createCanvasPage(pageNumber);
      const pageImageDataURL = canvasPage.toDataURL(
        this.options.canvas.mimeType,
        this.options.canvas.qualityRatio
      );
      this.pdf.setPage(pageNumber);
      this.pdf.addImage({
        imageData: pageImageDataURL,
        width: canvasPage.width / (this.getScale() * MM_TO_PX * this.getHorizontalFitFactor()),
        height: canvasPage.height / (this.getScale() * MM_TO_PX * this.getHorizontalFitFactor()),
        x: this.getMarginLeftMM(),
        y: this.getMarginTopMM()
      });
      pageNumber += 1;
    }
    return this.pdf;
  }
};

// src/utils.ts
var buildConvertOptions = (options) => {
  if (!options) {
    return DEFAULT_OPTIONS;
  }
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    canvas: { ...DEFAULT_OPTIONS.canvas, ...options.canvas },
    page: { ...DEFAULT_OPTIONS.page, ...options.page }
  };
};

// src/index.ts
var getTargetElement = (targetRefOrFunction) => {
  if (typeof targetRefOrFunction === "function") {
    return targetRefOrFunction();
  }
  return targetRefOrFunction?.current;
};
var usePDF = (usePDFoptions) => {
  const targetRef = useRef();
  const toPDF = useCallback(
    (toPDFoptions) => {
      return generatePDF(targetRef, usePDFoptions ?? toPDFoptions);
    },
    [targetRef, usePDFoptions]
  );
  return { targetRef, toPDF };
};
var generatePDF = async (targetRefOrFunction, customOptions) => {
  const options = buildConvertOptions(customOptions);
  const targetElement = getTargetElement(targetRefOrFunction);
  if (!targetElement) {
    console.error("Unable to get the target element.");
    return;
  }
  const canvas = await html2canvas(targetElement, {
    useCORS: options.canvas.useCORS,
    logging: options.canvas.logging,
    scale: options.resolution,
    ...options.overrides?.canvas
  });
  const converter = new Converter(canvas, options);
  const pdf = converter.convert();
  switch (options.method) {
    case "build":
      return pdf;
    case "open": {
      window.open(pdf.output("bloburl"), "_blank");
      return pdf;
    }
    case "save":
    default: {
      const pdfFilename = options.filename ?? `${(/* @__PURE__ */ new Date()).getTime()}.pdf`;
      await pdf.save(pdfFilename, { returnPromise: true });
      return pdf;
    }
  }
};
var index_default = generatePDF;
export {
  Margin,
  Resolution,
  index_default as default,
  usePDF
};
//# sourceMappingURL=index.mjs.map
