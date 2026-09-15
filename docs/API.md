# API and module map

All data APIs require a session. Writes also require trusted `Origin` and `X-XSRF-TOKEN`. Backend base URL is `/api`.

| Method | Endpoint                         | Purpose                                                      |
| ------ | -------------------------------- | ------------------------------------------------------------ |
| POST   | `/auth/login`                    | `{email,password}`; sets cookies and returns `{user}`        |
| GET    | `/auth/me`                       | Restore current user                                         |
| POST   | `/auth/logout`                   | Revoke session                                               |
| POST   | `/auth/change-password`          | `{currentPassword,newPassword}`; revoke all sessions         |
| GET    | `/bootstrap`                     | Allowed resources, safe directories and Owner/Admin activity |
| GET    | `/:resource?page=1&pageSize=200` | `{items,page,pageSize,total}`; max 200 per page              |
| POST   | `/:resource`                     | Create validated record; returns `{record}`                  |
| PATCH  | `/:resource/:id`                 | Partial update with `expectedRevision`; returns `{record}`   |
| DELETE | `/:resource/:id?revision=N`      | Delete eligible unreferenced record                          |
| POST   | `/leads/:id/convert`             | Convert Won lead once                                        |
| POST   | `/subscriptions/:id/invoice`     | `{cycleDate:"YYYY-MM-DD"}`; retry-safe recurring invoice     |
| POST   | `/attendance/check-out`          | Developer check-out for current business date                |
| GET    | `/notifications`                 | Latest 100 notifications for current user                    |
| PATCH  | `/notifications/:id/read`        | Mark own notification read                                   |
| GET    | `/health/live`, `/health/ready`  | Process/database checks                                      |

Creation defaults to the first status below. Optional blank values are cleared. Fields marked required in `src/config/resources.json`, plus identity/business-link fields in `src/validators/resource.validator.js`, must be present. Monetary derived fields cannot be supplied. See those files for the exact validation contract.

Payment POST requests additionally require a UUID `Idempotency-Key` header. Reuse it with identical request data after transport uncertainty. Your separate frontend must add this header and retain its key while the request outcome is uncertain in the current page session. After a full page reload, check existing receipts before re-entering an uncertain payment.

Responses: 401 unauthenticated, 403 forbidden/CSRF, 404 inaccessible or missing record, 409 revision/retention/uniqueness conflict, 422 validation, 429 rate limit, 500 unexpected failure. Error JSON: `{message,requestId}`.

## Resources

### plans — Monthly plans

Fields: `title` (text), `customerId` (customer), `month` (month), `platforms` (text), `posterTarget` (number), `reelTarget` (number), `storyTarget` (number), `videoTarget` (number), `assignedEmployees` (employee-list), `planDueDate` (date), `assetsDueDate` (date), `reportDueDate` (date).

Statuses: `PLANNED`, `ACTIVE`, `COMPLETED`.

### content — Content calendar

Fields: `title` (text), `marketingPlanId` (plan), `customerId` (customer), `contentType` (text), `platform` (text), `scheduledDate` (date), `assignedTo` (employee), `fileUrl` (url), `clientFeedback` (textarea), `approvalDueDate` (date).

Statuses: `PLANNED`, `ASSIGNED`, `CREATED`, `INTERNAL_REVIEW`, `CLIENT_REVIEW`, `REVISION`, `APPROVED`, `SCHEDULED`, `PUBLISHED`.

### campaigns — Ad campaigns

Fields: `title` (text), `customerId` (customer), `platform` (select), `objective` (text), `startDate` (date), `endDate` (date), `budget` (number), `actualSpend` (number), `leadCount` (number), `conversions` (number), `assignedTo` (employee), `notes` (textarea).

Statuses: `DRAFT`, `ACTIVE`, `PAUSED`, `COMPLETED`.

### campaignLeads — Campaign enquiries

Fields: `name` (text), `campaignId` (campaign), `customerId` (customer), `phone` (tel), `email` (email), `receivedDate` (date), `assignedTo` (employee), `notes` (textarea).

Statuses: `NEW`, `CONTACTED`, `INTERESTED`, `CONVERTED`, `LOST`.

### projects — All projects

Fields: `projectName` (text), `customerId` (customer), `projectType` (text), `description` (textarea), `projectManager` (employee), `assignedEmployees` (employee-list), `startDate` (date), `deadline` (date), `priority` (text), `progress` (number), `budget` (number).

Statuses: `REQUIREMENT`, `DESIGN`, `DEVELOPMENT`, `TESTING`, `INTERNAL_REVIEW`, `CLIENT_REVIEW`, `REVISION`, `DEPLOYMENT`, `COMPLETED`, `DELIVERED`.

### tasks — Tasks

Fields: `title` (text), `projectId` (project), `description` (textarea), `assignedTo` (employee), `dueDate` (date), `priority` (text), `progress` (number), `comments` (textarea), `attachments` (url).

Statuses: `TODO`, `IN_PROGRESS`, `REVIEW`, `CHANGES_REQUIRED`, `COMPLETED`.

### files — Project files

Fields: `title` (text), `projectId` (project), `fileUrl` (url), `notes` (textarea).

Statuses: `REQUIREMENTS`, `WORKING`, `DELIVERABLE`.

### leads — Leads

Fields: `businessName` (text), `contactPerson` (text), `phone` (tel), `email` (email), `location` (text), `interestedServices` (text), `source` (text), `assignedTo` (employee), `priority` (text), `nextFollowUpDate` (date), `notes` (textarea).

Statuses: `NEW`, `ASSIGNED`, `CONTACTED`, `FOLLOW_UP`, `INTERESTED`, `MEETING`, `QUOTATION`, `NEGOTIATION`, `WON`, `LOST`.

### calls — Call activity

Fields: `leadId` (lead), `employeeId` (employee), `callDate` (date), `notes` (textarea), `nextFollowUpDate` (date).

Statuses: `CONNECTED`, `NO_ANSWER`, `BUSY`, `SWITCHED_OFF`, `CALL_BACK`, `INTERESTED`, `NOT_INTERESTED`, `WRONG_NUMBER`, `MEETING_FIXED`.

### followups — Follow-ups

Fields: `leadId` (lead), `assignedTo` (employee), `followUpDate` (date), `followUpTime` (time), `type` (text), `notes` (textarea).

Statuses: `PENDING`, `COMPLETED`, `CANCELLED`.

### meetings — Meetings

Fields: `title` (text), `leadId` (lead), `date` (date), `time` (time), `meetingType` (text), `location` (text), `assignedEmployees` (employee-list), `outcome` (textarea), `nextAction` (text).

Statuses: `SCHEDULED`, `COMPLETED`, `CANCELLED`.

### quotations — Quotations

Fields: `quotationNumber` (text), `leadId` (lead), `description` (textarea), `subtotal` (number), `discount` (number), `tax` (number), `paymentTerms` (text), `validUntil` (date).

Statuses: `DRAFT`, `SENT`, `ACCEPTED`, `REJECTED`, `EXPIRED`.

### employees — Employees

Fields: `name` (text), `email` (email), `phone` (tel), `department` (text), `designation` (text), `joiningDate` (date), `reportingManager` (employee), `employmentType` (text).

Statuses: `ACTIVE`, `ON_LEAVE`, `INACTIVE`.

### attendance — Attendance

Fields: `employeeId` (employee), `date` (date), `checkIn` (time), `checkOut` (time).

Statuses: `PRESENT`, `ABSENT`, `HALF_DAY`, `REMOTE`.

### leave — Leave requests

Fields: `employeeId` (employee), `leaveType` (text), `startDate` (date), `endDate` (date), `reason` (textarea).

Statuses: `PENDING`, `APPROVED`, `REJECTED`.

### users — User access

Fields: `name` (text), `email` (email), `role` (role), `employeeId` (employee), `initialPassword` (password).

Statuses: `ACTIVE`, `INACTIVE`.

### services — Services

Fields: `name` (text), `description` (textarea).

Statuses: `ACTIVE`, `INACTIVE`.

### departments — Departments

Fields: `name` (text), `description` (text).

Statuses: `ACTIVE`, `INACTIVE`.

### billingProfile — Billing profile

Fields: `name` (text), `address` (textarea), `email` (email), `phone` (tel), `taxId` (text), `bankDetails` (textarea), `terms` (textarea).

Statuses: `ACTIVE`.

### tickets — Support tickets

Fields: `title` (text), `customerId` (customer), `projectId` (project), `description` (textarea), `priority` (text), `assignedTo` (employee), `resolution` (textarea), `dueDate` (date).

Statuses: `OPEN`, `ASSIGNED`, `IN_PROGRESS`, `WAITING_CLIENT`, `RESOLVED`, `CLOSED`.

### renewals — Renewals

Fields: `serviceName` (text), `customerId` (customer), `renewalType` (text), `startDate` (date), `expiryDate` (date), `amount` (number), `assignedTo` (employee), `notes` (textarea).

Statuses: `ACTIVE`, `DUE_SOON`, `CONTACTED`, `RENEWED`, `EXPIRED`.

### invoices — Invoices

Fields: `invoiceNumber` (text), `customerId` (customer), `projectId` (project), `description` (textarea), `subtotal` (number), `tax` (number), `discount` (number), `invoiceDate` (date), `dueDate` (date), `subscriptionId` (subscription), `billingPeriod` (month).

Statuses: `DRAFT`, `SENT`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`.

### installments — Installments

Fields: `installmentName` (text), `invoiceId` (invoice), `amount` (number), `dueDate` (date), `notes` (textarea).

Statuses: `PENDING`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`.

### payments — Payments

Fields: `invoiceId` (invoice), `installmentId` (installment), `amount` (number), `paymentDate` (date), `paymentMethod` (text), `transactionReference` (text), `notes` (textarea), `visitId` (visit), `promiseId` (promise).

Statuses: `RECEIVED`.

### expenses — Expenses

Fields: `description` (text), `category` (text), `amount` (number), `expenseDate` (date), `paymentMethod` (text), `projectId` (project), `receiptUrl` (url).

Statuses: `PENDING`, `APPROVED`, `REJECTED`.

### promises — Payment promises

Fields: `title` (text), `customerId` (customer), `invoiceId` (invoice), `amount` (number), `promisedDate` (date), `assignedTo` (employee), `visitId` (visit), `notes` (textarea).

Statuses: `OPEN`, `PARTIALLY_FULFILLED`, `FULFILLED`, `BROKEN`, `CANCELLED`.

### subscriptions — Recurring services

Fields: `serviceName` (text), `customerId` (customer), `serviceType` (select), `amount` (number), `frequency` (select), `startDate` (date), `nextBillingDate` (date), `paymentDueDays` (number), `assignedTo` (employee), `notes` (textarea).

Statuses: `ACTIVE`, `PAUSED`, `CANCELLED`.

### customers — All customers

Fields: `businessName` (text), `contactPerson` (text), `phone` (tel), `email` (email), `address` (textarea), `location` (text), `services` (text), `accountManager` (employee).

Statuses: `ACTIVE`, `INACTIVE`.

### visits — Customer visits

Fields: `title` (select), `customerId` (customer), `visitDate` (date), `visitTime` (time), `assignedTo` (employee), `location` (text), `outcome` (textarea), `nextAction` (text), `nextFollowUpDate` (date), `notes` (textarea).

Statuses: `PLANNED`, `COMPLETED`, `CANCELLED`.
