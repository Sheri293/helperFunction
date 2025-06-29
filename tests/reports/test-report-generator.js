import ExcelJS from "exceljs";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

const HELPER_FUNCTIONS = [
  "convertNumberWithComma",
  "requiredFieldsOk",
  "cleanValues",
  "setOrderId",
  "setShippingWeight",
  "mapOrder",
  "capitalizeWords",
  "likeName",
  "formatManufacturerValues",
  "formatManufacturerObject",
  "clipParams",
  "getBasicAggregations",
  "formateShouldArray",
  "formateFiltersAgg",
  "formateFiltersArray",
  "formateProducts",
  "formateSpecsAggregations",
  "parseFilters",
  "buildSearchQuery",
  "buildRangeFilter",
  "buildNestedFilter",
  "buildBoolQuery",
  "getSpecsDetailsFromES",
  "getDynamicFilters",
  "getRelatedProductsFromES",
  "getProductAccessoriesFromES",
  "getProductDetailsFromES",
  "getProductListFromES",
];

const WORKSHEET_NAMES = {
  SUMMARY: "Test Summary",
  RESULTS: "Detailed Results",
  COVERAGE: "Function Coverage",
};

const COLUMN_HEADERS = {
  SUMMARY: ["Metric", "Value"],
  RESULTS: ["Test Name", "Status", "Duration (ms)", "Helper Function"],
  COVERAGE: ["Helper Function", "Test Count", "Pass Rate"],
};

const COLUMN_WIDTHS = {
  SUMMARY: [{ width: 25 }, { width: 20 }],
  RESULTS: [{ width: 50 }, { width: 15 }, { width: 18 }, { width: 25 }],
  COVERAGE: [{ width: 30 }, { width: 15 }, { width: 15 }],
};

const CELL_COLORS = {
  PASSED: { argb: "FF90EE90" },
  FAILED: { argb: "FFFF6B6B" },
};

const SMTP_CONFIG = {
  DEFAULT_PORT: "587",
  CONTENT_TYPE:
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const ERROR_CODES = {
  AUTH: "EAUTH",
  CONNECTION: "ECONNECTION",
};

const DEFAULT_FUNCTION = "General Testing";
const REPORTS_DIR = "reports";

class TestReportGenerator {
  constructor() {
    this.workbook = new ExcelJS.Workbook();
    this.reportData = {
      summary: { totalTests: 0, passed: 0, failed: 0, duration: 0 },
      testResults: [],
      coverage: {},
    };
  }

  addTestResult(testResult) {
    this.reportData.testResults.push({
      testName: testResult.title,
      status: testResult.outcome,
      duration: testResult.duration,
      helperFunction: this.extractHelperFunction(testResult.title),
    });
    this.updateSummary(testResult);
  }

  extractHelperFunction(testTitle) {
    return (
      HELPER_FUNCTIONS.find((func) =>
        testTitle.toLowerCase().includes(func.toLowerCase())
      ) || DEFAULT_FUNCTION
    );
  }

  updateSummary(testResult) {
    this.reportData.summary.totalTests++;
    if (testResult.outcome === "passed") this.reportData.summary.passed++;
    else this.reportData.summary.failed++;
    this.reportData.summary.duration += testResult.duration || 0;
  }

  createSummarySheet() {
    const summarySheet = this.workbook.addWorksheet(WORKSHEET_NAMES.SUMMARY);
    const { summary } = this.reportData;

    summarySheet.addRow(["Helper Functions Test Report", ""]);
    summarySheet.addRow(["Generated", new Date().toLocaleString()]);
    summarySheet.addRow([]);

    summarySheet.addRow(COLUMN_HEADERS.SUMMARY);
    summarySheet.addRow(["Total Tests", summary.totalTests]);
    summarySheet.addRow(["Passed", summary.passed]);
    summarySheet.addRow(["Failed", summary.failed]);
    summarySheet.addRow([
      "Success Rate",
      `${((summary.passed / summary.totalTests) * 100).toFixed(2)}%`,
    ]);
    summarySheet.addRow(["Total Duration", `${summary.duration}ms`]);

    this.applySummaryStyles(summarySheet);
    return summarySheet;
  }

  applySummaryStyles(sheet) {
    sheet.getRow(1).font = { bold: true, size: 14 };
    sheet.getRow(4).font = { bold: true };
    sheet.columns = COLUMN_WIDTHS.SUMMARY;
  }

  createResultsSheet() {
    const resultsSheet = this.workbook.addWorksheet(WORKSHEET_NAMES.RESULTS);

    resultsSheet.addRow(COLUMN_HEADERS.RESULTS);

    this.reportData.testResults.forEach((test) => {
      const row = resultsSheet.addRow([
        test.testName,
        test.status,
        test.duration,
        test.helperFunction,
      ]);

      this.applyResultRowColor(row, test.status);
    });

    this.applyResultsStyles(resultsSheet);
    return resultsSheet;
  }

  applyResultRowColor(row, status) {
    const color = status === "passed" ? CELL_COLORS.PASSED : CELL_COLORS.FAILED;
    row.getCell(2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: color,
    };
  }

  applyResultsStyles(sheet) {
    sheet.getRow(1).font = { bold: true };
    sheet.columns = COLUMN_WIDTHS.RESULTS;
  }

  createCoverageSheet() {
    const coverageSheet = this.workbook.addWorksheet(WORKSHEET_NAMES.COVERAGE);

    coverageSheet.addRow(COLUMN_HEADERS.COVERAGE);

    const functionCoverage = this.calculateFunctionCoverage();

    Object.entries(functionCoverage).forEach(([func, stats]) => {
      const passRate = ((stats.passed / stats.total) * 100).toFixed(1);
      coverageSheet.addRow([func, stats.total, `${passRate}%`]);
    });

    this.applyCoverageStyles(coverageSheet);
    return coverageSheet;
  }

  calculateFunctionCoverage() {
    const functionCoverage = {};

    this.reportData.testResults.forEach((test) => {
      const func = test.helperFunction;
      if (!functionCoverage[func]) {
        functionCoverage[func] = { total: 0, passed: 0 };
      }
      functionCoverage[func].total++;
      if (test.status === "passed") {
        functionCoverage[func].passed++;
      }
    });

    return functionCoverage;
  }

  applyCoverageStyles(sheet) {
    sheet.getRow(1).font = { bold: true };
    sheet.columns = COLUMN_WIDTHS.COVERAGE;
  }

  generateFileName() {
    const dateString = new Date().toISOString().split("T")[0];
    return `test-report-${dateString}.xlsx`;
  }

  ensureReportsDirectory() {
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
  }

  async generateExcelReport() {
    this.createSummarySheet();
    this.createResultsSheet();
    this.createCoverageSheet();

    const fileName = this.generateFileName();
    const filePath = path.join(process.cwd(), REPORTS_DIR, fileName);

    this.ensureReportsDirectory();

    await this.workbook.xlsx.writeFile(filePath);
    console.log(`Excel report generated: ${filePath}`);
    return filePath;
  }

  createTransporter() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || SMTP_CONFIG.DEFAULT_PORT),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER || process.env.EMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
      },
    });
  }

  createEmailBody() {
    const { summary } = this.reportData;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2>Helper Functions Test Report</h2>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
          <p><strong>Total Tests:</strong> ${summary.totalTests}</p>
          <p><strong>Passed:</strong> ${summary.passed}</p>
          <p><strong>Failed:</strong> ${summary.failed}</p>
          <p><strong>Success Rate:</strong> ${(
            (summary.passed / summary.totalTests) *
            100
          ).toFixed(2)}%</p>
          <p><strong>Total Duration:</strong> ${summary.duration}ms</p>
        </div>
        <p>Please find the detailed Excel report attached.</p>
        <p><em>Generated on ${new Date().toLocaleString()}</em></p>
      </div>
    `;
  }

  createEmailSubject() {
    const { summary } = this.reportData;
    const successRate = ((summary.passed / summary.totalTests) * 100).toFixed(
      1
    );
    return `Helper Functions Test Report - ${successRate}% Success Rate`;
  }

  createEmailAttachment(filePath) {
    return {
      filename: path.basename(filePath),
      path: filePath,
      contentType: SMTP_CONFIG.CONTENT_TYPE,
    };
  }

  handleEmailError(emailError) {
    console.error("Email sending failed:");
    console.error("Error:", emailError.message);

    if (emailError.code === ERROR_CODES.AUTH) {
      console.error("Authentication failed - check your email credentials");
      console.error(
        "For Gmail, you may need an App Password instead of your regular password"
      );
    } else if (emailError.code === ERROR_CODES.CONNECTION) {
      console.error("Connection failed - check your SMTP settings");
    }

    throw emailError;
  }

  async sendEmailReport(filePath, recipients) {
    try {
      console.log("Configuring email transport...");

      const transporter = this.createTransporter();

      console.log("Testing email connection...");
      await transporter.verify();
      console.log("Email server connection verified");

      console.log("Sending email...");
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: recipients.join(", "),
        subject: this.createEmailSubject(),
        html: this.createEmailBody(),
        attachments: [this.createEmailAttachment(filePath)],
      });

      console.log("Email sent successfully!");
      console.log(`Message ID: ${info.messageId}`);
      console.log(`Recipients: ${recipients.join(", ")}`);
    } catch (emailError) {
      this.handleEmailError(emailError);
    }
  }
}

export async function generateAndSendTestReport(
  testResults = [],
  emailRecipients = []
) {
  const reporter = new TestReportGenerator();

  console.log(`Processing ${testResults.length} test results...`);

  testResults.forEach((result) => reporter.addTestResult(result));

  const filePath = await reporter.generateExcelReport();

  if (emailRecipients.length > 0) {
    try {
      await reporter.sendEmailReport(filePath, emailRecipients);
    } catch (emailError) {
      console.error(
        "Email delivery failed, but report was generated successfully"
      );
      console.error("Report available at:", filePath);
    }
  } else {
    console.log("No email recipients configured - skipping email delivery");
  }

  return {
    filePath,
    summary: reporter.reportData.summary,
  };
}
