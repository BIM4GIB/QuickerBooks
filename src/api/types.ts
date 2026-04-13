export interface QBRef {
  value: string;
  name?: string;
}

export interface Address {
  Line1?: string;
  City?: string;
  CountrySubDivisionCode?: string;
  PostalCode?: string;
  Country?: string;
}

export interface EmailAddress {
  Address: string;
}

export interface PhoneNumber {
  FreeFormNumber: string;
}

export interface Customer {
  Id?: string;
  SyncToken?: string;
  DisplayName: string;
  GivenName?: string;
  FamilyName?: string;
  CompanyName?: string;
  PrimaryEmailAddr?: EmailAddress;
  PrimaryPhone?: PhoneNumber;
  BillAddr?: Address;
  ShipAddr?: Address;
  Balance?: number;
  Active?: boolean;
}

export interface SalesItemLineDetail {
  ItemRef: QBRef;
  Qty?: number;
  UnitPrice?: number;
}

export interface InvoiceLine {
  Amount: number;
  DetailType: "SalesItemLineDetail";
  SalesItemLineDetail: SalesItemLineDetail;
}

export interface Invoice {
  Id?: string;
  SyncToken?: string;
  DocNumber?: string;
  CustomerRef: QBRef;
  Line: InvoiceLine[];
  DueDate?: string;
  TxnDate?: string;
  EmailStatus?: string;
  Balance?: number;
  TotalAmt?: number;
}

export interface LinkedTxn {
  TxnId: string;
  TxnType: string;
}

export interface PaymentLine {
  Amount: number;
  LinkedTxn: LinkedTxn[];
}

export interface Payment {
  Id?: string;
  SyncToken?: string;
  TotalAmt: number;
  CustomerRef: QBRef;
  PaymentMethodRef?: QBRef;
  TxnDate?: string;
  Line?: PaymentLine[];
}

export interface Vendor {
  Id?: string;
  SyncToken?: string;
  DisplayName: string;
  GivenName?: string;
  FamilyName?: string;
  CompanyName?: string;
  PrimaryEmailAddr?: EmailAddress;
  PrimaryPhone?: PhoneNumber;
  Balance?: number;
  Active?: boolean;
}

export interface Item {
  Id?: string;
  SyncToken?: string;
  Name: string;
  Type?: "Inventory" | "NonInventory" | "Service";
  UnitPrice?: number;
  IncomeAccountRef?: QBRef;
  ExpenseAccountRef?: QBRef;
  Active?: boolean;
}

export interface CompanyInfo {
  CompanyName: string;
  LegalName?: string;
  CompanyAddr?: Address;
  Country?: string;
  FiscalYearStartMonth?: string;
  CompanyStartDate?: string;
}

export interface QBFault {
  Error?: Array<{
    Message: string;
    Detail: string;
    code: string;
  }>;
  type?: string;
}

// --- Additional entities ---

export interface Estimate {
  Id?: string;
  SyncToken?: string;
  DocNumber?: string;
  CustomerRef: QBRef;
  Line: InvoiceLine[];
  DueDate?: string;
  TxnDate?: string;
  TotalAmt?: number;
  TxnStatus?: string;
  ExpirationDate?: string;
}

export interface Bill {
  Id?: string;
  SyncToken?: string;
  DocNumber?: string;
  VendorRef: QBRef;
  Line: BillLine[];
  DueDate?: string;
  TxnDate?: string;
  Balance?: number;
  TotalAmt?: number;
}

export interface BillLine {
  Amount: number;
  DetailType: "AccountBasedExpenseLineDetail" | "ItemBasedExpenseLineDetail";
  AccountBasedExpenseLineDetail?: { AccountRef: QBRef };
  ItemBasedExpenseLineDetail?: { ItemRef: QBRef; Qty?: number; UnitPrice?: number };
}

export interface JournalEntry {
  Id?: string;
  SyncToken?: string;
  DocNumber?: string;
  TxnDate?: string;
  Line: JournalEntryLine[];
  TotalAmt?: number;
}

export interface JournalEntryLine {
  Amount: number;
  DetailType: "JournalEntryLineDetail";
  JournalEntryLineDetail: {
    PostingType: "Debit" | "Credit";
    AccountRef: QBRef;
    Description?: string;
  };
}

export interface Account {
  Id?: string;
  SyncToken?: string;
  Name: string;
  AccountType?: string;
  AccountSubType?: string;
  CurrentBalance?: number;
  Active?: boolean;
  FullyQualifiedName?: string;
}

