import { generateAndSendTestReport } from "../tests/reports/test-report-generator.js";

const MESSAGES = {
  INIT: "Initializing comprehensive test report generation system...",
  ANALYZING:
    "Analyzing helper function test coverage and performance metrics...",
  PROCESSING: "Processing test data and generating advanced Excel analytics...",
  CREATING:
    "Creating multi-sheet workbook with detailed function coverage analysis...",
  SUCCESS: "REPORT GENERATION SUCCESSFULLY COMPLETED",
  SEPARATOR: "======================================================",
  EMAIL_INITIATED: "AUTOMATED EMAIL DELIVERY INITIATED",
  EMAIL_SKIPPED: "EMAIL DISTRIBUTION SKIPPED",
  COMPLETION: "SENIOR SDET AUTOMATION FRAMEWORK EXECUTION COMPLETE",
  ERROR_HEADER: "CRITICAL ERROR IN REPORT GENERATION SYSTEM",
  CONTACT_MSG: "Contact Senior SDET Engineer for immediate resolution",
};

const logReportDetails = (reportResult) => {
  const successRate = (
    (reportResult.summary.passed / reportResult.summary.totalTests) *
    100
  ).toFixed(2);

  console.log(`Professional Excel Report Generated: ${reportResult.filePath}`);
  console.log(
    `Total Test Functions Analyzed: ${reportResult.summary.totalTests}`
  );
  console.log(`Success Rate: ${successRate}%`);
};

const logEmailStatus = (emailRecipients) => {
  if (emailRecipients.length > 0) {
    console.log(MESSAGES.EMAIL_INITIATED);
    console.log(
      `Report successfully distributed to stakeholders: ${emailRecipients.join(
        ", "
      )}`
    );
    console.log(
      "Email contains detailed Excel attachment with comprehensive analysis"
    );
  } else {
    console.log(MESSAGES.EMAIL_SKIPPED);
    console.log(
      "Configure EMAIL_RECIPIENTS environment variable to enable automated distribution"
    );
    console.log(
      "Example: EMAIL_RECIPIENTS=sdet@company.com,qa-lead@company.com,dev-team@company.com"
    );
  }
};

const handleError = (error) => {
  console.error(MESSAGES.ERROR_HEADER);
  console.error(`Error Details: ${error.message}`);
  console.error(`Stack Trace: ${error.stack}`);
  console.error(MESSAGES.CONTACT_MSG);
  process.exit(1);
};

async function generateReportOnly() {
  console.log(MESSAGES.INIT);
  console.log(MESSAGES.ANALYZING);

  try {
    const emailRecipients = process.env.EMAIL_RECIPIENTS?.split(",") || [];

    console.log(MESSAGES.PROCESSING);
    console.log(MESSAGES.CREATING);

    const reportResult = await generateAndSendTestReport([], emailRecipients);

    console.log(MESSAGES.SUCCESS);
    console.log(MESSAGES.SEPARATOR);

    logReportDetails(reportResult);

    console.log(MESSAGES.SEPARATOR);

    logEmailStatus(emailRecipients);

    console.log(MESSAGES.SEPARATOR);
    console.log(MESSAGES.COMPLETION);
    console.log(
      "Report contains detailed function validation results and coverage metrics"
    );
  } catch (error) {
    handleError(error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateReportOnly();
}

export { generateReportOnly };
