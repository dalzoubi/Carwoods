import React from 'react';
import SeoHead from './SeoHead';
import { organizationSchema, softwareApplicationSchema } from '../seo/structuredData';
import { Link, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import AssignmentInd from '@mui/icons-material/AssignmentInd';
import Build from '@mui/icons-material/Build';
import SmartToy from '@mui/icons-material/SmartToy';
import Description from '@mui/icons-material/Description';
import Payments from '@mui/icons-material/Payments';
import Forum from '@mui/icons-material/Forum';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import { alpha, useTheme } from '@mui/material/styles';
import { withDarkPath } from '../routePaths';
import { useTranslation } from 'react-i18next';
import managersPhoto from '../assets/home/mid-hero-home.jpg';

const FEATURES = [
    { icon: AssignmentInd, titleKey: 'selfManagedLandlords.feature1Heading', bodyKey: 'selfManagedLandlords.feature1Body' },
    { icon: Build, titleKey: 'selfManagedLandlords.feature2Heading', bodyKey: 'selfManagedLandlords.feature2Body' },
    { icon: SmartToy, titleKey: 'selfManagedLandlords.feature3Heading', bodyKey: 'selfManagedLandlords.feature3Body' },
    { icon: Description, titleKey: 'selfManagedLandlords.feature4Heading', bodyKey: 'selfManagedLandlords.feature4Body' },
    { icon: Payments, titleKey: 'selfManagedLandlords.feature5Heading', bodyKey: 'selfManagedLandlords.feature5Body' },
    { icon: Forum, titleKey: 'selfManagedLandlords.feature6Heading', bodyKey: 'selfManagedLandlords.feature6Body' },
];

const SelfManagedLandlords = () => {
    const theme = useTheme();
    const { pathname } = useLocation();
    const { t } = useTranslation();

    const heroBg = alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.06);
    const heroBorder = alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.32 : 0.2);

    return (
        <Stack component="article" spacing={4}>
            <SeoHead
                title={t('selfManagedLandlords.title')}
                description={t('selfManagedLandlords.metaDescription')}
                path="/self-managed-landlords"
                jsonLd={[organizationSchema, softwareApplicationSchema]}
            />

            {/* Hero section */}
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1fr) minmax(0,1fr)' },
                    gap: { xs: 2.5, md: 4 },
                    alignItems: 'center',
                    px: { xs: 2.5, sm: 3.5 },
                    py: { xs: 3.5, sm: 4.5 },
                    borderRadius: 3,
                    bgcolor: heroBg,
                    border: '1px solid',
                    borderColor: heroBorder,
                    backgroundImage: `linear-gradient(135deg, ${heroBg} 0%, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.04 : 0.01)} 100%)`,
                }}
            >
                <Box>
                    <Typography
                        variant="h1"
                        component="h1"
                        sx={{
                            fontSize: { xs: '1.65rem', sm: '2rem', md: '2.3rem' },
                            fontWeight: 800,
                            lineHeight: 1.2,
                            color: 'text.primary',
                            mb: 1.25,
                        }}
                    >
                        {t('selfManagedLandlords.heading')}
                    </Typography>
                    <Typography
                        component="p"
                        sx={{
                            color: 'primary.main',
                            fontWeight: 700,
                            fontSize: { xs: '0.95rem', sm: '1rem' },
                            mb: 1.5,
                        }}
                    >
                        {t('selfManagedLandlords.personaTagline')}
                    </Typography>
                    <Typography
                        variant="subtitle1"
                        component="p"
                        sx={{ color: 'text.secondary', lineHeight: 1.55, mb: 2.5, fontSize: { xs: '0.95rem', sm: '1rem' } }}
                    >
                        {t('selfManagedLandlords.heroSubtitle')}
                    </Typography>
                    <Stack spacing={1} sx={{ mb: 3 }}>
                        {['heroBenefit1', 'heroBenefit2', 'heroBenefit3'].map((key) => (
                            <Stack key={key} direction="row" spacing={1} alignItems="flex-start">
                                <CheckCircleOutline
                                    sx={{ color: 'primary.main', fontSize: '1.15rem', mt: 0.2, flexShrink: 0 }}
                                    aria-hidden
                                />
                                <Typography variant="body2" color="text.secondary">
                                    {t(`selfManagedLandlords.${key}`)}
                                </Typography>
                            </Stack>
                        ))}
                    </Stack>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                        <Button
                            component={Link}
                            to={withDarkPath(pathname, '/pricing')}
                            variant="contained"
                            size="large"
                            aria-label={t('selfManagedLandlords.heroCtaAriaLabel')}
                            sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                px: 3,
                                py: 1.25,
                                fontSize: '1rem',
                                borderRadius: 2,
                            }}
                        >
                            {t('selfManagedLandlords.heroCtaButton')}
                        </Button>
                        <Button
                            component={Link}
                            to={withDarkPath(pathname, '/portal')}
                            variant="outlined"
                            size="large"
                            aria-label={t('selfManagedLandlords.heroSecondaryCtaAriaLabel')}
                            sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                px: 3,
                                py: 1.25,
                                fontSize: '1rem',
                                borderRadius: 2,
                            }}
                        >
                            {t('selfManagedLandlords.heroSecondaryCta')}
                        </Button>
                    </Stack>
                </Box>
                <Box
                    data-print-hide
                    sx={{
                        borderRadius: 2,
                        overflow: 'hidden',
                        minHeight: { xs: 200, md: 260 },
                        maxHeight: { md: 340 },
                        boxShadow:
                            theme.palette.mode === 'dark'
                                ? `0 12px 28px ${alpha(theme.palette.common.black, 0.4)}`
                                : `0 16px 40px ${alpha(theme.palette.common.black, 0.1)}`,
                    }}
                >
                    <Box
                        component="img"
                        src={managersPhoto}
                        alt=""
                        aria-hidden
                        width={1200}
                        height={750}
                        sizes="(max-width: 900px) 100vw, 45vw"
                        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: { xs: 200, md: 260 } }}
                    />
                </Box>
            </Box>

            {/* Features grid */}
            <Box component="section" aria-labelledby="self-managed-features-heading">
                <Typography
                    id="self-managed-features-heading"
                    variant="h2"
                    component="h2"
                    sx={{ fontWeight: 700, fontSize: { xs: '1.35rem', sm: '1.6rem' }, mb: 2.5, color: 'text.primary' }}
                >
                    {t('selfManagedLandlords.featuresHeading')}
                </Typography>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                        gap: 2.5,
                    }}
                >
                    {FEATURES.map(({ icon: Icon, titleKey, bodyKey }) => (
                        <Paper
                            key={titleKey}
                            elevation={0}
                            sx={{
                                p: 2.75,
                                borderRadius: 2,
                                border: '1px solid',
                                borderColor: 'divider',
                                bgcolor: 'background.paper',
                                backgroundImage: 'none',
                            }}
                        >
                            <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 1 }}>
                                <Icon
                                    sx={{ color: 'primary.main', fontSize: '1.5rem', mt: 0.25, flexShrink: 0 }}
                                    aria-hidden
                                />
                                <Typography variant="h3" component="h3" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary' }}>
                                    {t(titleKey)}
                                </Typography>
                            </Stack>
                            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                                {t(bodyKey)}
                            </Typography>
                        </Paper>
                    ))}
                </Box>
            </Box>

            {/* Why self-manage */}
            <Paper
                component="section"
                aria-labelledby="self-managed-why-heading"
                elevation={0}
                sx={{
                    p: { xs: 2.75, sm: 3.5 },
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.07 : 0.04),
                    backgroundImage: 'none',
                }}
            >
                <Typography
                    id="self-managed-why-heading"
                    variant="h2"
                    component="h2"
                    sx={{ fontWeight: 700, fontSize: { xs: '1.25rem', sm: '1.45rem' }, mb: 1.5, color: 'text.primary' }}
                >
                    {t('selfManagedLandlords.whyHeading')}
                </Typography>
                <Typography color="text.secondary" sx={{ lineHeight: 1.65 }}>
                    {t('selfManagedLandlords.whyBody')}
                </Typography>
            </Paper>

            {/* Compare CTA */}
            <Box
                component="section"
                aria-labelledby="self-managed-compare-cta-heading"
                sx={{
                    textAlign: 'center',
                    py: { xs: 3.5, sm: 4.5 },
                    px: { xs: 2.5, sm: 3.5 },
                    borderRadius: 3,
                    bgcolor: heroBg,
                    border: '1px solid',
                    borderColor: heroBorder,
                }}
            >
                <Typography
                    id="self-managed-compare-cta-heading"
                    variant="h2"
                    component="h2"
                    sx={{ fontWeight: 700, fontSize: { xs: '1.35rem', sm: '1.6rem' }, mb: 1.25, color: 'text.primary' }}
                >
                    {t('selfManagedLandlords.compareSectionHeading')}
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 560, mx: 'auto' }}>
                    {t('selfManagedLandlords.compareSectionBody')}
                </Typography>
                <Button
                    component={Link}
                    to={withDarkPath(pathname, '/property-management#compare')}
                    variant="contained"
                    size="large"
                    aria-label={t('selfManagedLandlords.compareCtaAriaLabel')}
                    sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        px: 3.5,
                        py: 1.25,
                        fontSize: '1rem',
                        borderRadius: 2,
                    }}
                >
                    {t('selfManagedLandlords.compareCtaLabel')}
                </Button>
            </Box>
        </Stack>
    );
};

export default SelfManagedLandlords;
