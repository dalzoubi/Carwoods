import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    Avatar,
    Box,
    Button,
    Chip,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import Dashboard from '@mui/icons-material/Dashboard';
import HomeWork from '@mui/icons-material/HomeWork';
import People from '@mui/icons-material/People';
import Build from '@mui/icons-material/Build';
import Notifications from '@mui/icons-material/Notifications';
import Check from '@mui/icons-material/Check';
import ArrowForward from '@mui/icons-material/ArrowForward';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import { alpha, useTheme } from '@mui/material/styles';
import SeoHead from './SeoHead';
import { organizationSchema, softwareApplicationSchema } from '../seo/structuredData';
import { Heading } from '../styles';
import { useTranslation } from 'react-i18next';
import { withDarkPath } from '../routePaths';
import elsaPhoto from '../assets/elsa-assistant.webp';

const FeatureSection = ({ icon, heading, body, reversed }) => {
    const theme = useTheme();
    return (
        <Paper
            elevation={0}
            sx={{
                p: { xs: 2.5, sm: 3 },
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 3,
                bgcolor: 'background.paper',
                backgroundImage: 'none',
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'auto 1fr' },
                gap: { xs: 1.5, sm: 2.5 },
                alignItems: 'flex-start',
            }}
        >
            <Box
                sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'primary.main',
                    flexShrink: 0,
                }}
            >
                {icon}
            </Box>
            <Box>
                <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mb: 0.75 }}>
                    {heading}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    {body}
                </Typography>
            </Box>
        </Paper>
    );
};

const Features = () => {
    const { t } = useTranslation();
    const theme = useTheme();
    const { pathname } = useLocation();

    const featureSections = [
        { icon: <Dashboard />, heading: t('features.dashboardFeatureHeading'), body: t('features.dashboardFeatureBody') },
        { icon: <HomeWork />, heading: t('features.propertiesFeatureHeading'), body: t('features.propertiesFeatureBody') },
        { icon: <People />, heading: t('features.tenantsFeatureHeading'), body: t('features.tenantsFeatureBody') },
        { icon: <Build />, heading: t('features.requestsFeatureHeading'), body: t('features.requestsFeatureBody') },
        { icon: <Notifications />, heading: t('features.notificationsFeatureHeading'), body: t('features.notificationsFeatureBody') },
    ];

    const elsaCapabilities = [
        t('features.elsaCapability1'),
        t('features.elsaCapability2'),
        t('features.elsaCapability3'),
        t('features.elsaCapability4'),
        t('features.elsaCapability5'),
        t('features.elsaCapability6'),
    ];

    const requestStatuses = [
        t('features.statusOpen'),
        t('features.statusAcknowledged'),
        t('features.statusScheduled'),
        t('features.statusWaitingVendor'),
        t('features.statusWaitingTenant'),
        t('features.statusComplete'),
    ];

    const managerGets = [
        t('features.managerGets1'),
        t('features.managerGets2'),
        t('features.managerGets3'),
        t('features.managerGets4'),
        t('features.managerGets5'),
    ];

    const tenantGets = [
        t('features.tenantGets1'),
        t('features.tenantGets2'),
        t('features.tenantGets3'),
        t('features.tenantGets4'),
        t('features.tenantGets5'),
    ];

    const heroTint = alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.06);

    return (
        <Stack component="article" spacing={4}>
            <SeoHead
                title={t('features.title')}
                description={t('features.metaDescription')}
                path="/features"
                jsonLd={[organizationSchema, softwareApplicationSchema]}
            />

            {/* Hero */}
            <Box
                sx={{
                    px: { xs: 2.25, sm: 3.5 },
                    py: { xs: 3, sm: 4 },
                    borderRadius: 2,
                    bgcolor: heroTint,
                    border: '1px solid',
                    borderColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.35 : 0.2),
                    textAlign: 'center',
                }}
            >
                <Heading>{t('features.heading')}</Heading>
                <Typography
                    variant="subtitle1"
                    color="text.secondary"
                    sx={{ mt: 1, maxWidth: 560, mx: 'auto', lineHeight: 1.6 }}
                >
                    {t('features.subheading')}
                </Typography>
            </Box>

            {/* Elsa spotlight */}
            <Paper
                component="section"
                aria-labelledby="features-elsa-heading"
                elevation={0}
                sx={{
                    p: { xs: 3, sm: 4 },
                    border: '2px solid',
                    borderColor: 'primary.main',
                    borderRadius: 3,
                    bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.03),
                    backgroundImage: 'none',
                }}
            >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 4 }} alignItems={{ xs: 'center', sm: 'flex-start' }}>
                    {/* Avatar + identity */}
                    <Stack alignItems="center" spacing={1} sx={{ flexShrink: 0 }}>
                        <Avatar
                            src={elsaPhoto}
                            alt={t('features.elsaPhotoAlt')}
                            sx={{ width: 96, height: 96, border: '3px solid', borderColor: 'primary.main' }}
                        />
                        <Typography variant="h6" component="div" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1 }}>
                            {t('portalRequests.elsaName', 'Elsa')}
                        </Typography>
                        <Chip
                            label={t('portalRequests.aiAssistantRole', 'AI Assistant')}
                            color="primary"
                            size="small"
                            sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                        />
                    </Stack>

                    {/* Description + capabilities */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <Typography id="features-elsa-heading" variant="h5" component="h2" sx={{ fontWeight: 800 }}>
                                {t('features.elsaSectionHeading')}
                            </Typography>
                            <Chip
                                icon={<AutoAwesome sx={{ fontSize: '0.85rem !important' }} />}
                                label={t('features.elsaGrowingChip')}
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ fontWeight: 700, fontSize: '0.65rem' }}
                            />
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.7 }}>
                            {t('features.elsaIntro')}
                        </Typography>
                        <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            flexWrap="wrap"
                            useFlexGap
                            spacing={1}
                            sx={{ mb: 2.5 }}
                        >
                            {elsaCapabilities.map((cap, i) => (
                                <Stack key={i} direction="row" spacing={0.75} alignItems="flex-start" sx={{ flex: { md: '1 1 45%' }, minWidth: 0 }}>
                                    <Check sx={{ fontSize: '1rem', color: 'primary.main', mt: 0.2, flexShrink: 0 }} aria-hidden />
                                    <Typography variant="body2" sx={{ lineHeight: 1.5 }}>{cap}</Typography>
                                </Stack>
                            ))}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            {t('features.elsaGrowingNote')}
                        </Typography>
                    </Box>
                </Stack>
            </Paper>

            {/* Feature cards */}
            <Stack spacing={2}>
                {featureSections.map((f, i) => (
                    <FeatureSection key={i} icon={f.icon} heading={f.heading} body={f.body} />
                ))}
            </Stack>

            {/* Maintenance request statuses */}
            <Box
                component="section"
                aria-labelledby="features-statuses-heading"
                sx={{
                    p: { xs: 2.5, sm: 3 },
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.06 : 0.03),
                }}
            >
                <Typography
                    id="features-statuses-heading"
                    variant="h6"
                    component="h2"
                    sx={{ fontWeight: 700, mb: 2 }}
                >
                    {t('features.requestStatusesHeading')}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {requestStatuses.map((status) => (
                        <Chip
                            key={status}
                            label={status}
                            variant="outlined"
                            size="small"
                            sx={{ fontWeight: 600, mb: 0.5 }}
                        />
                    ))}
                </Stack>
            </Box>

            {/* Property manager vs tenant comparison */}
            <Box component="section" aria-labelledby="features-compare-heading">
                <Typography
                    id="features-compare-heading"
                    variant="h5"
                    component="h2"
                    sx={{ fontWeight: 700, mb: 2.5, textAlign: 'center' }}
                >
                    {t('features.compareHeading')}
                </Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} useFlexGap>
                    <Paper
                        elevation={0}
                        sx={{
                            flex: 1,
                            p: 3,
                            border: '1px solid',
                            borderColor: 'primary.main',
                            borderRadius: 2,
                            backgroundImage: 'none',
                        }}
                    >
                        <Typography
                            variant="subtitle2"
                            sx={{
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                color: 'primary.main',
                                letterSpacing: 0.06,
                                mb: 2,
                            }}
                        >
                            Property Managers Get
                        </Typography>
                        <Stack spacing={1}>
                            {managerGets.map((item, i) => (
                                <Stack key={i} direction="row" spacing={1} alignItems="center">
                                    <Check sx={{ fontSize: '1rem', color: 'primary.main', flexShrink: 0 }} aria-hidden />
                                    <Typography variant="body2">{item}</Typography>
                                </Stack>
                            ))}
                        </Stack>
                    </Paper>
                    <Paper
                        elevation={0}
                        sx={{
                            flex: 1,
                            p: 3,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            backgroundImage: 'none',
                        }}
                    >
                        <Typography
                            variant="subtitle2"
                            sx={{
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                color: 'text.secondary',
                                letterSpacing: 0.06,
                                mb: 2,
                            }}
                        >
                            Tenants Get
                        </Typography>
                        <Stack spacing={1}>
                            {tenantGets.map((item, i) => (
                                <Stack key={i} direction="row" spacing={1} alignItems="center">
                                    <Check sx={{ fontSize: '1rem', color: 'success.main', flexShrink: 0 }} aria-hidden />
                                    <Typography variant="body2">{item}</Typography>
                                </Stack>
                            ))}
                        </Stack>
                    </Paper>
                </Stack>
            </Box>

            {/* CTA */}
            <Box
                component="section"
                sx={{
                    textAlign: 'center',
                    py: { xs: 3, sm: 4 },
                    px: { xs: 2, sm: 3 },
                    borderRadius: 2,
                    bgcolor: heroTint,
                    border: '1px solid',
                    borderColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.3 : 0.18),
                }}
            >
                <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1 }}>
                    {t('features.ctaHeading')}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    {t('features.ctaBody')}
                </Typography>
                <Button
                    component={Link}
                    to={withDarkPath(pathname, '/pricing')}
                    variant="contained"
                    size="large"
                    endIcon={<ArrowForward />}
                    aria-label={t('features.ctaButtonAria')}
                    sx={{ textTransform: 'none', fontWeight: 700, px: 3, borderRadius: 2 }}
                >
                    {t('features.ctaButton')}
                </Button>
            </Box>
        </Stack>
    );
};

export default Features;
