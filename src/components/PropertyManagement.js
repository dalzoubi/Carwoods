import React from 'react';
import { Helmet } from 'react-helmet';
import { Heading, Paragraph } from '../styles';

const PropertyManagement = () => {
    return (
        <div>
            <Helmet>
                <title>Carwoods - Property Management</title>
            </Helmet>
            <Heading>Property Management</Heading>

            <section aria-labelledby="section-1">
                <h2 id="section-1">1. Appointment of Property Manager</h2>
                <Paragraph>
                    The Owner appoints the Property Manager as the exclusive agent to rent, lease, operate, and manage
                    the Property.
                </Paragraph>
            </section>

            <section aria-labelledby="section-2">
                <h2 id="section-2">2. Term</h2>
                <Paragraph>
                    This Agreement shall commence on [Start Date] and continue until [End Date] unless terminated earlier
                    in accordance with the terms herein.
                </Paragraph>
            </section>

            <section aria-labelledby="section-3">
                <h2 id="section-3">3. Management Fee</h2>
                <Paragraph>
                    The Owner agrees to pay the Property Manager a management fee of 8% of the monthly rental income.
                    Additional fees may apply for specific services as outlined in Section 4.
                </Paragraph>
            </section>

            <section aria-labelledby="section-4">
                <h2 id="section-4">4. Services Provided</h2>
                <Paragraph>The Property Manager agrees to perform the following services:</Paragraph>
                <ul>
                    <li>Marketing and advertising the Property for rent.</li>
                    <li>Screening and selecting tenants.</li>
                    <li>Collecting rent and security deposits.</li>
                    <li>Conducting regular property inspections.</li>
                    <li>Arranging for repairs and maintenance.</li>
                    <li>Handling tenant complaints and disputes.</li>
                    <li>Preparing and enforcing lease agreements.</li>
                    <li>Providing annual financial statements to the Owner.</li>
                    <li>Providing monthly financial statements to the Owner upon request.</li>
                </ul>
            </section>

            <section aria-labelledby="section-5">
                <h2 id="section-5">5. Expenses</h2>
                <Paragraph>
                    The Owner agrees to reimburse the Property Manager for all reasonable expenses incurred in the
                    management of the Property, including but not limited to:
                </Paragraph>
                <ul>
                    <li>Maintenance and repair costs.</li>
                    <li>Advertising and marketing expenses.</li>
                    <li>Legal fees for lease enforcement and eviction processes.</li>
                </ul>
            </section>

            <section aria-labelledby="section-6">
                <h2 id="section-6">6. Reserve Fund</h2>
                <Paragraph>
                    The Owner agrees to establish and maintain a reserve fund of $1,000 to be held by the Property
                    Manager. This fund is to be used for emergency repairs, unforeseen expenses, and any other expenses
                    necessary for the upkeep and maintenance of the property that are not covered by the regular
                    operating budget. The Property Manager is authorized to use this reserve fund as needed to cover
                    such expenses.
                </Paragraph>
                <Paragraph>
                    The Property Manager shall notify the Owner promptly when the reserve fund falls below the specified
                    amount. The reserve fund will be replenished from the rental income collected by the Property
                    Manager until it reaches the $1,000 level. The Property Manager shall provide the Owner with an
                    accounting of all expenditures from the reserve fund in the monthly financial reports.
                </Paragraph>
            </section>

            <section aria-labelledby="section-7">
                <h2 id="section-7">7. Owner&apos;s Responsibilities</h2>
                <Paragraph>The Owner agrees to:</Paragraph>
                <ul>
                    <li>Maintain adequate property insurance.</li>
                    <li>Provide funds for necessary repairs and maintenance.</li>
                    <li>Approve any repair or maintenance costs exceeding $500.00 before work is performed.</li>
                </ul>
            </section>

            <section aria-labelledby="section-8">
                <h2 id="section-8">8. Annual Reporting</h2>
                <Paragraph>
                    The Property Manager shall provide the Owner with detailed annual reports, including but not limited
                    to, the following:
                </Paragraph>
                <ol>
                    <li>An income statement showing rental income, management fees, operating expenses, and any other
                        deductions.
                    </li>
                    <li>A balance sheet showing the current financial status of the property.</li>
                    <li>A statement of the reserve fund, including all contributions and expenditures.</li>
                    <li>A summary of any significant events or issues that occurred during the calendar year.</li>
                </ol>
                <Paragraph>
                    These reports shall be delivered to the Owner within 15 days after the end of each calendar year.
                </Paragraph>
            </section>

            <section aria-labelledby="section-9">
                <h2 id="section-9">9. Termination</h2>
                <Paragraph>
                    Either party may terminate this Agreement with 30 days&apos; written notice. In the event of termination,
                    the Property Manager shall be entitled to all management fees and reimbursement for expenses
                    incurred up to the date of termination.
                </Paragraph>
            </section>

            <section aria-labelledby="section-10">
                <h2 id="section-10">10. Indemnification</h2>
                <Paragraph>
                    The Owner agrees to indemnify and hold the Property Manager harmless from any and all claims, losses,
                    damages, liabilities, and expenses arising out of or related to the management of the Property,
                    except in cases of gross negligence or willful misconduct by the Property Manager.
                </Paragraph>
            </section>

            <section aria-labelledby="section-11">
                <h2 id="section-11">11. Governing Law</h2>
                <Paragraph>
                    This Agreement shall be governed by and construed in accordance with the laws of the State of
                    TEXAS.
                </Paragraph>
            </section>

            <section aria-labelledby="section-12">
                <h2 id="section-12">12. Entire Agreement</h2>
                <Paragraph>
                    This Agreement constitutes the entire agreement between the parties and supersedes all prior
                    agreements or understandings, whether written or oral, relating to the subject matter herein.
                </Paragraph>
            </section>
        </div>
    );
};

export default PropertyManagement;
