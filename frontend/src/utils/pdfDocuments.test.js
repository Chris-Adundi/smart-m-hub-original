jest.mock("jspdf", () => ({ __esModule: true, default: jest.fn() }));

import { amountInWords } from "./pdfDocuments";

describe("PDF document helpers", () => {
  test("formats Kenyan shilling amounts without changing the recorded value", () => {
    expect(amountInWords(5000)).toBe("Five Thousand Kenya Shillings Only");
    expect(amountInWords(2000.5)).toBe("Two Thousand Kenya Shillings and Fifty Cents Only");
  });

  test("handles missing monetary values safely", () => {
    expect(amountInWords(null)).toBe("Zero Kenya Shillings Only");
  });
});
