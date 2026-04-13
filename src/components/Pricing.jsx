import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    Chip,
    Divider,
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
import { alpha, useTheme } from '@mui/material/styles';
import { Helmet } from 'react-helmet';
import { Heading } from '../styles';
import { useTranslation } from 'react-i18next';
import { withDarkPath } from '../routePaths';

const PlanCard = ({ tier, tagline, price, pricePeriod, features, cta, ctaAria, ctaTo, highlighted, comingSoon }) => {
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
            <Box sx={{ mb: 2.5 }}>
                <Typography variant="h5" component="h2" sx={{ fontWeight: 800, mb: 0.5 }}>
                    {tier}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {tagline}
                </Typography>
            </Box>
            <Box sx={{ mb: 3 }}>
                <Typography
                    component="span"
                    sx={{ fontSize: '2.25rem', fontWeight: 800, color: 'text.primary', lineHeight: 1 }}
                >
                    {price}
                </Typography>
                {pricePeriod && (
                    <Typography
                        component="span"
                        variant="body2"
                        color="text.secondary"
                        sx={{ ml: 0.75 }}
                    >
                        {pricePeriod}
                    </Typography>
                )}
            </Box>
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
                <Button
                    variant="outlined"
                    fullWidth
                    disabled
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
                >
                    {cta}
                </Button>
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

    const freeFeatures = [
        { label: '1 property', included: true },
        { label: 'Unlimited maintenance requests', included: true },
        { label: 'Tenant portal access', included: true },
        { label: 'In-app & email notifications', included: true },
        { label: 'AI maintenance routing', included: false },
        { label: 'Document storage', included: false },
        { label: 'Reports & CSV export', included: false },
    ];

    const starterFeatures = [
        { label: 'Up to 5 properties', included: true },
        { label: 'Unlimited maintenance requests', included: true },
        { label: 'Tenant portal access', included: true },
        { label: 'In-app, email & SMS notifications', included: true },
        { label: 'AI maintenance routing (ELSA)', included: true },
        { label: 'Document storage', included: true },
        { label: 'Reports & CSV export', included: true },
    ];

    const proFeatures = [
        { label: 'Unlimited properties', included: true },
        { label: 'Unlimited maintenance requests', included: true },
        { label: 'Tenant portal access', included: true },
        { label: 'In-app, email & SMS notifications', included: true },
        { label: 'AI maintenance routing (ELSA)', included: true },
        { label: 'Document storage', included: true },
        { label: 'Reports & CSV export', included: true },
        { label: 'Custom branding', included: true },
        { label: 'Priority support', included: true },
    ];

    const featureRows = [
        { label: t('pricing.featureProperties'), free: t('pricing.featurePropertiesFree'), starter: t('pricing.featurePropertiesStarter'), pro: t('pricing.featurePropertiesPro') },
        { label: t('pricing.featureTenantPortal'), free: true, starter: true, pro: true },
        { label: t('pricing.featureMaintenanceRequests'), free: t('pricing.featureMaintenanceRequestsFree'), starter: t('pricing.featureMaintenanceRequestsStarter'), pro: t('pricing.featureMaintenanceRequestsPro') },
        { label: t('pricing.featureAiRouting'), free: false, starter: true, pro: true },
        { label: t('pricing.featureDocStorage'), free: false, starter: true, pro: true },
        { label: t('pricing.featureReports'), free: false, starter: true, pro: true },
        { label: t('pricing.featureWhiteLabel'), free: false, starter: false, pro: true },
        { label: t('pricing.featurePrioritySupport'), free: false, starter: false, pro: true },
    ];

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
            <Helmet>
                <title>{t('pricing.title')}</title>
                <meta name="description" content={t('pricing.metaDescription')} />
            </Helmet>

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
                alignItems={{ xs: 'stretch', md: 'flex-start' }}
            >
                <PlanCard
                    tier={t('pricing.freeTierLabel')}
                    tagline={t('pricing.freeTierTagline')}
                    price={t('pricing.freeTierPrice')}
                    pricePeriod={t('pricing.freeTierPricePeriod')}
                    features={freeFeatures}
                    cta={t('pricing.freeTierCta')}
                    ctaAria={t('pricing.freeTierCtaAria')}
                    ctaTo={withDarkPath(pathname, '/portal')}
                    highlighted={false}
                    comingSoon={false}
                />
                <PlanCard
                    tier={t('pricing.starterTierLabel')}
                    tagline={t('pricing.starterTierTagline')}
                    price={t('pricing.starterTierPrice')}
                    pricePeriod={t('pricing.starterTierPricePeriod')}
                    features={starterFeatures}
                    cta={t('pricing.starterTierCta')}
                    ctaAria={t('pricing.starterTierCtaAria')}
                    highlighted={true}
                    comingSoon={true}
                />
                <PlanCard
                    tier={t('pricing.proTierLabel')}
                    tagline={t('pricing.proTierTagline')}
                    price={t('pricing.proTierPrice')}
                    pricePeriod={t('pricing.proTierPricePeriod')}
                    features={proFeatures}
                    cta={t('pricing.proTierCta')}
                    ctaAria={t('pricing.proTierCtaAria')}
                    highlighted={false}
                    comingSoon={true}
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
                                    {t('pricing.starterTierLabel')}
                                </TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700 }}>{t('pricing.proTierLabel')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
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
