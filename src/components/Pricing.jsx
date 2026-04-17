import React, { useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    Chip,
    Dialog,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import Check from '@mui/icons-material/Check';
import Remove from '@mui/icons-material/Remove';
import ExpandMore from '@mui/icons-material/ExpandMore';
import RocketLaunch from '@mui/icons-material/RocketLaunch';
import Close from '@mui/icons-material/Close';
import { alpha, useTheme } from '@mui/material/styles';
import SeoHead from './SeoHead';
import ContactUs from './ContactUs';
import { organizationSchema, softwareApplicationSchema, buildFaqSchema } from '../seo/structuredData';
import { Heading } from '../styles';
import { useTranslation } from 'react-i18next';
import { withDarkPath } from '../routePaths';

const WAITLIST_SUBJECT = 'PAID_SUBSCRIPTION';

const PlanCard = ({
    tier,
    tagline,
    capacity,
    price,
    pricePeriod,
    features,
    cta,
    ctaAria,
    ctaTo,
    highlighted,
    comingSoon,
    comingSoonLabel,
    waitlistSubject,
    onWaitlistClick,
}) => {
    const theme = useTheme();
    return (
        <Paper
            elevation={0}
            sx={{
                flex: { xs: '1 1 auto', md: '1 1 280px' },
                maxWidth: { md: 340 },
                p: 3,
                border: '2px solid',
                borderColor: highlighted ? 'primary.main' : 'divider',
                borderRadius: 3,
                bgcolor: highlighted
                    ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.1 : 0.04)
                    : 'background.paper',
                backgroundImage: 'none',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                opacity: comingSoon ? 0.92 : 1,
            }}
        >
            {highlighted && (
                <Chip
                    label="Most Popular"
                    color="primary"
                    size="small"
                    sx={{
                        position: 'absolute',
                        top: -13,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontWeight: 700,
                        fontSize: '0.7rem',
                    }}
                />
            )}
            {comingSoon && (
                <Chip
                    label={comingSoonLabel}
                    size="small"
                    sx={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        fontWeight: 700,
                        fontSize: '0.65rem',
                        letterSpacing: 0.05,
                        textTransform: 'uppercase',
                        bgcolor: alpha(theme.palette.warning.main, theme.palette.mode === 'dark' ? 0.2 : 0.15),
                        color: theme.palette.warning.dark,
                        border: '1px solid',
                        borderColor: alpha(theme.palette.warning.main, 0.4),
                    }}
                />
            )}
            <Box sx={{ mb: 2.5 }}>
                <Typography variant="h5" component="h2" sx={{ fontWeight: 800, mb: 0.5 }}>
                    {tier}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {tagline}
                </Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
                <Typography
                    component="div"
                    sx={{ fontSize: '2.25rem', fontWeight: 800, color: 'text.primary', lineHeight: 1 }}
                >
                    {price}
                </Typography>
                {pricePeriod && (
                    <Typography
                        component="div"
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 0.5 }}
                    >
                        {pricePeriod}
                    </Typography>
                )}
            </Box>
            {capacity && (
                <Box
                    sx={{
                        mb: 3,
                        px: 1.5,
                        py: 1,
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.06),
                        border: '1px solid',
                        borderColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.25 : 0.15),
                    }}
                >
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        {capacity}
                    </Typography>
                </Box>
            )}
            <Stack spacing={1} sx={{ mb: 3, flex: 1 }}>
                {features.map((f, i) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                        {f.included ? (
                            <Check sx={{ fontSize: '1.1rem', color: 'success.main', mt: 0.15, flexShrink: 0 }} aria-hidden />
                        ) : (
                            <Remove sx={{ fontSize: '1.1rem', color: 'text.disabled', mt: 0.15, flexShrink: 0 }} aria-hidden />
                        )}
                        <Typography variant="body2" color={f.included ? 'text.primary' : 'text.disabled'}>
                            {f.label}
                        </Typography>
                    </Stack>
                ))}
            </Stack>
            {comingSoon ? (
                waitlistSubject && onWaitlistClick ? (
                    <Button
                        type="button"
                        variant={highlighted ? 'contained' : 'outlined'}
                        fullWidth
                        onClick={() => onWaitlistClick(waitlistSubject)}
                        aria-label={ctaAria}
                        startIcon={<RocketLaunch />}
                        sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, py: 1.1 }}
                    >
                        {cta}
                    </Button>
                ) : (
                    <Button
                        variant="outlined"
                        fullWidth
                        disabled
                        sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
                    >
                        {cta}
                    </Button>
                )
            ) : (
                <Button
                    component={Link}
                    to={ctaTo}
                    variant={highlighted ? 'contained' : 'outlined'}
                    fullWidth
                    aria-label={ctaAria}
                    startIcon={<RocketLaunch />}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, py: 1.1 }}
                >
                    {cta}
                </Button>
            )}
        </Paper>
    );
};

const Pricing = () => {
    const { t } = useTranslation();
    const theme = useTheme();
    const { pathname } = useLocation();

    const [waitlistOpen, setWaitlistOpen] = useState(false);
    const [waitlistSubject, setWaitlistSubject] = useState(WAITLIST_SUBJECT);
    const [waitlistSession, setWaitlistSession] = useState(0);

    const handleOpenWaitlist = useCallback((subject) => {
        setWaitlistSubject(subject);
        setWaitlistSession((n) => n + 1);
        setWaitlistOpen(true);
    }, []);

    const handleCloseWaitlist = useCallback(() => {
        setWaitlistOpen(false);
    }, []);

    const sharedFeatures = [
        { key: 'featureTenantPortal', label: t('pricing.featureTenantPortal', 'Tenant portal access') },
        { key: 'featureMaintenanceRequests', label: t('pricing.featureMaintenanceRequests', 'Maintenance requests') },
        { key: 'featureNotifications', label: t('pricing.featureNotifications', 'In-app & email notifications') },
        { key: 'featureSms', label: t('pricing.featureSms', 'SMS notifications') },
        { key: 'featureAiRouting', label: t('pricing.featureAiRouting', 'AI maintenance routing') },
        { key: 'featureDocStorage', label: t('pricing.featureDocStorage', 'Document storage') },
        { key: 'featureRentLedger', label: t('pricing.featureRentLedger', 'Rent ledger & payment tracking') },
        { key: 'featureReports', label: t('pricing.featureReports', 'Reports & exports') },
        { key: 'featureWhiteLabel', label: t('pricing.featureWhiteLabel', 'Custom branding') },
        { key: 'featurePrioritySupport', label: t('pricing.featurePrioritySupport', 'Priority support') },
        { key: 'featureTeamAccess', label: t('pricing.featureTeamAccess', 'Team member accounts') },
    ];

    const inclusion = {
        free: {
            featureTenantPortal: true,
            featureMaintenanceRequests: true,
            featureNotifications: true,
            featureSms: false,
            featureAiRouting: false,
            featureDocStorage: false,
            featureRentLedger: false,
            featureReports: false,
            featureWhiteLabel: false,
            featurePrioritySupport: false,
            featureTeamAccess: false,
        },
        starter: {
            featureTenantPortal: true,
            featureMaintenanceRequests: true,
            featureNotifications: true,
            featureSms: true,
            featureAiRouting: true,
            featureDocStorage: true,
            featureRentLedger: true,
            featureReports: true,
            featureWhiteLabel: false,
            featurePrioritySupport: false,
            featureTeamAccess: false,
        },
        pro: {
            featureTenantPortal: true,
            featureMaintenanceRequests: true,
            featureNotifications: true,
            featureSms: true,
            featureAiRouting: true,
            featureDocStorage: true,
            featureRentLedger: true,
            featureReports: true,
            featureWhiteLabel: true,
            featurePrioritySupport: true,
            featureTeamAccess: true,
        },
    };

    const freeFeatures = sharedFeatures.map((f) => ({ label: f.label, included: inclusion.free[f.key] }));
    const starterFeatures = sharedFeatures.map((f) => ({ label: f.label, included: inclusion.starter[f.key] }));
    const proFeatures = sharedFeatures.map((f) => ({ label: f.label, included: inclusion.pro[f.key] }));

    const featureRows = sharedFeatures.map((f) => ({
        label: f.label,
        free: inclusion.free[f.key],
        starter: inclusion.starter[f.key],
        pro: inclusion.pro[f.key],
    }));

    const faqs = [
        { q: t('pricing.faq1Question'), a: t('pricing.faq1Answer') },
        { q: t('pricing.faq2Question'), a: t('pricing.faq2Answer') },
        { q: t('pricing.faq3Question'), a: t('pricing.faq3Answer') },
        { q: t('pricing.faq4Question'), a: t('pricing.faq4Answer') },
        { q: t('pricing.faq5Question'), a: t('pricing.faq5Answer') },
    ];

    const renderCell = (val) => {
        if (val === true) return <Check sx={{ color: 'success.main', fontSize: '1.1rem' }} aria-label="Included" />;
        if (val === false) return <Remove sx={{ color: 'text.disabled', fontSize: '1.1rem' }} aria-label="Not included" />;
        return <Typography variant="body2" color="text.secondary">{val}</Typography>;
    };

    return (
        <Stack component="article" spacing={5}>
            <Dialog
                open={waitlistOpen}
                onClose={handleCloseWaitlist}
                fullWidth
                maxWidth="sm"
                scroll="paper"
                aria-labelledby="pricing-waitlist-dialog-title"
            >
                <DialogTitle
                    id="pricing-waitlist-dialog-title"
                    sx={{
                        position: 'relative',
                        pr: 6,
                        fontWeight: 800,
                        backgroundImage: 'none',
                    }}
                >
                    {t('contact.heading')}
                    <IconButton
                        type="button"
                        onClick={handleCloseWaitlist}
                        aria-label={t('pricing.closeWaitlistDialog', 'Close join waitlist form')}
                        sx={{
                            position: 'absolute',
                            insetBlockStart: 8,
                            insetInlineEnd: 8,
                            color: 'text.secondary',
                        }}
                        size="small"
                    >
                        <Close />
                    </IconButton>
                </DialogTitle>
                <DialogContent
                    dividers
                    sx={{
                        backgroundImage: 'none',
                        pt: 2,
                    }}
                >
                    {waitlistOpen ? (
                        <ContactUs embedded initialSubject={waitlistSubject} key={waitlistSession} />
                    ) : null}
                </DialogContent>
            </Dialog>

            <SeoHead
                title={t('pricing.title')}
                description={t('pricing.metaDescription')}
                path="/pricing"
                jsonLd={[organizationSchema, softwareApplicationSchema, buildFaqSchema(faqs.map(f => ({ question: f.q, answer: f.a })))]}
            />

            {/* Hero */}
            <Box sx={{ textAlign: 'center', py: { xs: 1, sm: 2 } }}>
                <Heading>{t('pricing.heading')}</Heading>
                <Typography
                    variant="subtitle1"
                    color="text.secondary"
                    sx={{ mt: 1, maxWidth: 520, mx: 'auto', lineHeight: 1.6 }}
                >
                    {t('pricing.subheading')}
                </Typography>
            </Box>

            {/* Tier cards */}
            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2.5}
                useFlexGap
                justifyContent="center"
                alignItems="stretch"
            >
                <PlanCard
                    tier={t('pricing.freeTierLabel')}
                    tagline={t('pricing.freeTierTagline')}
                    capacity={t('pricing.featurePropertiesFree', '1 property')}
                    price={t('pricing.freeTierPrice')}
                    pricePeriod={t('pricing.freeTierPricePeriod')}
                    features={freeFeatures}
                    cta={t('pricing.freeTierCta')}
                    ctaAria={t('pricing.freeTierCtaAria')}
                    ctaTo={withDarkPath(pathname, '/portal')}
                    highlighted={false}
                    comingSoon={false}
                    comingSoonLabel={t('pricing.comingSoonBadge', 'Coming Soon')}
                />
                <PlanCard
                    tier={t('pricing.starterTierLabel')}
                    tagline={t('pricing.starterTierTagline')}
                    capacity={t('pricing.featurePropertiesStarter', 'Up to 5 properties')}
                    price={t('pricing.starterTierPrice')}
                    pricePeriod={t('pricing.starterTierPricePeriod')}
                    features={starterFeatures}
                    cta={t('pricing.starterTierCta')}
                    ctaAria={t('pricing.starterTierCtaAria')}
                    highlighted={true}
                    comingSoon={true}
                    comingSoonLabel={t('pricing.comingSoonBadge', 'Coming Soon')}
                    waitlistSubject={WAITLIST_SUBJECT}
                    onWaitlistClick={handleOpenWaitlist}
                />
                <PlanCard
                    tier={t('pricing.proTierLabel')}
                    tagline={t('pricing.proTierTagline')}
                    capacity={t('pricing.featurePropertiesPro', 'Unlimited properties')}
                    price={t('pricing.proTierPrice')}
                    pricePeriod={t('pricing.proTierPricePeriod')}
                    features={proFeatures}
                    cta={t('pricing.proTierCta')}
                    ctaAria={t('pricing.proTierCtaAria')}
                    highlighted={false}
                    comingSoon={true}
                    comingSoonLabel={t('pricing.comingSoonBadge', 'Coming Soon')}
                    waitlistSubject={WAITLIST_SUBJECT}
                    onWaitlistClick={handleOpenWaitlist}
                />
            </Stack>

            {/* Feature comparison table */}
            <Box component="section" aria-labelledby="pricing-compare-heading">
                <Typography
                    id="pricing-compare-heading"
                    variant="h5"
                    component="h2"
                    sx={{ fontWeight: 700, mb: 2.5, textAlign: 'center' }}
                >
                    {t('pricing.featureTableHeading')}
                </Typography>
                <TableContainer
                    component={Paper}
                    elevation={0}
                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, backgroundImage: 'none' }}
                >
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 700, width: '40%' }}></TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700 }}>{t('pricing.freeTierLabel')}</TableCell>
                                <TableCell
                                    align="center"
                                    sx={{
                                        fontWeight: 700,
                                        bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.1 : 0.04),
                                    }}
                                >
                                    {t('pricing.starterTierLabelShort', 'Pay as You Grow')}
                                </TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700 }}>{t('pricing.proTierLabel')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.06 : 0.02) }}>
                                <TableCell sx={{ color: 'text.primary', fontWeight: 700 }}>{t('pricing.featureProperties', 'Properties')}</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 600 }}>{t('pricing.featurePropertiesFree', '1 property')}</TableCell>
                                <TableCell
                                    align="center"
                                    sx={{ fontWeight: 600, bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.05 : 0.02) }}
                                >
                                    {t('pricing.featurePropertiesStarter', 'Up to 5 properties')}
                                </TableCell>
                                <TableCell align="center" sx={{ fontWeight: 600 }}>{t('pricing.featurePropertiesPro', 'Unlimited properties')}</TableCell>
                            </TableRow>
                            {featureRows.map((row, i) => (
                                <TableRow
                                    key={i}
                                    sx={{ '&:last-child td': { borderBottom: 0 } }}
                                >
                                    <TableCell sx={{ color: 'text.primary', fontWeight: 500 }}>{row.label}</TableCell>
                                    <TableCell align="center">{renderCell(row.free)}</TableCell>
                                    <TableCell
                                        align="center"
                                        sx={{ bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.05 : 0.02) }}
                                    >
                                        {renderCell(row.starter)}
                                    </TableCell>
                                    <TableCell align="center">{renderCell(row.pro)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>

            {/* FAQ */}
            <Box component="section" aria-labelledby="pricing-faq-heading">
                <Typography
                    id="pricing-faq-heading"
                    variant="h5"
                    component="h2"
                    sx={{ fontWeight: 700, mb: 2.5, textAlign: 'center' }}
                >
                    {t('pricing.faqHeading')}
                </Typography>
                <Stack spacing={1}>
                    {faqs.map((faq, i) => (
                        <Accordion
                            key={i}
                            elevation={0}
                            sx={{
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: '8px !important',
                                '&:before': { display: 'none' },
                                backgroundImage: 'none',
                            }}
                        >
                            <AccordionSummary
                                expandIcon={<ExpandMore />}
                                aria-controls={`faq-${i}-content`}
                                id={`faq-${i}-header`}
                            >
                                <Typography sx={{ fontWeight: 600 }}>{faq.q}</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Divider sx={{ mb: 1.5 }} />
                                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                                    {faq.a}
                                </Typography>
                            </AccordionDetails>
                        </Accordion>
                    ))}
                </Stack>
            </Box>
        </Stack>
    );
};

export default Pricing;
