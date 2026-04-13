import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import HomeWork from '@mui/icons-material/HomeWork';
import PeopleAlt from '@mui/icons-material/PeopleAlt';
import Build from '@mui/icons-material/Build';
import Assessment from '@mui/icons-material/Assessment';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import { alpha, useTheme } from '@mui/material/styles';
import { withDarkPath } from '../routePaths';
import { useTranslation } from 'react-i18next';
import ownersPhoto from '../assets/home/owners-skyline.jpg';

const SERVICES = [
    { icon: HomeWork, titleKey: 'propertyManagement.service1Heading', bodyKey: 'propertyManagement.service1Body' },
    { icon: PeopleAlt, titleKey: 'propertyManagement.service2Heading', bodyKey: 'propertyManagement.service2Body' },
    { icon: Build, titleKey: 'propertyManagement.service3Heading', bodyKey: 'propertyManagement.service3Body' },
    { icon: Assessment, titleKey: 'propertyManagement.service4Heading', bodyKey: 'propertyManagement.service4Body' },
];

const PropertyManagement = () => {
    const theme = useTheme();
    const { pathname } = useLocation();
    const { t } = useTranslation();

    const heroBg = alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.06);
    const heroBorder = alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.32 : 0.2);

    return (
        <Stack component="article" spacing={4}>
            <Helmet>
                <title>{t('propertyManagement.title')}</title>
                <meta name="description" content={t('propertyManagement.metaDescription')} />
            </Helmet>

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
                        variant="overline"
                        component="p"
                        sx={{ fontWeight: 800, color: 'primary.main', letterSpacing: 0.08, mb: 1, fontSize: '0.75rem' }}
                    >
                        Carwoods Houston
                    </Typography>
                    <Typography
                        variant="h1"
                        component="h1"
                        sx={{
                            fontSize: { xs: '1.65rem', sm: '2rem', md: '2.3rem' },
                            fontWeight: 800,
                            lineHeight: 1.2,
                            color: 'text.primary',
                            mb: 1.75,
                        }}
                    >
                        {t('propertyManagement.heading')}
                    </Typography>
                    <Typography
                        variant="subtitle1"
                        component="p"
                        sx={{ color: 'text.secondary', lineHeight: 1.55, mb: 2.5, fontSize: { xs: '0.95rem', sm: '1rem' } }}
                    >
                        {t('propertyManagement.heroSubtitle')}
                    </Typography>
                    <Stack spacing={1} sx={{ mb: 3 }}>
                        {['heroBenefit1', 'heroBenefit2', 'heroBenefit3'].map((key) => (
                            <Stack key={key} direction="row" spacing={1} alignItems="flex-start">
                                <CheckCircleOutline
                                    sx={{ color: 'primary.main', fontSize: '1.15rem', mt: 0.2, flexShrink: 0 }}
                                    aria-hidden
                                />
                                <Typography variant="body2" color="text.secondary">
                                    {t(`propertyManagement.${key}`)}
                                </Typography>
                            </Stack>
                        ))}
                    </Stack>
                    <Button
                        component={Link}
                        to={withDarkPath(pathname, '/contact-us')}
                        variant="contained"
                        size="large"
                        aria-label={t('propertyManagement.heroCtaAriaLabel')}
                        sx={{
                            textTransform: 'none',
                            fontWeight: 700,
                            px: 3,
                            py: 1.25,
                            fontSize: '1rem',
                            borderRadius: 2,
                        }}
                    >
                        {t('propertyManagement.heroCtaButton')}
                    </Button>
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
                        src={ownersPhoto}
                        alt=""
                        aria-hidden
                        width={1200}
                        height={750}
                        sizes="(max-width: 900px) 100vw, 45vw"
                        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: { xs: 200, md: 260 } }}
                    />
                </Box>
            </Box>

            {/* Services grid */}
            <Box component="section" aria-labelledby="services-heading">
                <Typography
                    id="services-heading"
                    variant="h2"
                    component="h2"
                    sx={{ fontWeight: 700, fontSize: { xs: '1.35rem', sm: '1.6rem' }, mb: 2.5, color: 'text.primary' }}
                >
                    {t('propertyManagement.servicesHeading')}
                </Typography>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                        gap: 2.5,
                    }}
                >
                    {SERVICES.map(({ icon: Icon, titleKey, bodyKey }) => (
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

            {/* Why Carwoods */}
            <Paper
                component="section"
                aria-labelledby="why-carwoods-heading"
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
                    id="why-carwoods-heading"
                    variant="h2"
                    component="h2"
                    sx={{ fontWeight: 700, fontSize: { xs: '1.25rem', sm: '1.45rem' }, mb: 1.5, color: 'text.primary' }}
                >
                    {t('propertyManagement.whyCarwoodsHeading')}
                </Typography>
                <Typography color="text.secondary" sx={{ lineHeight: 1.65, maxWidth: 680 }}>
                    {t('propertyManagement.whyCarwoodsBody')}
                </Typography>
            </Paper>

            {/* CTA section */}
            <Box
                component="section"
                aria-labelledby="pm-cta-heading"
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
                    id="pm-cta-heading"
                    variant="h2"
                    component="h2"
                    sx={{ fontWeight: 700, fontSize: { xs: '1.35rem', sm: '1.6rem' }, mb: 1.25, color: 'text.primary' }}
                >
                    {t('propertyManagement.ctaSectionHeading')}
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 480, mx: 'auto' }}>
                    {t('propertyManagement.ctaSectionBody')}
                </Typography>
                <Button
                    component={Link}
                    to={withDarkPath(pathname, '/contact-us')}
                    variant="contained"
                    size="large"
                    aria-label={t('propertyManagement.heroCtaAriaLabel')}
                    sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        px: 3.5,
                        py: 1.25,
                        fontSize: '1rem',
                        borderRadius: 2,
                    }}
                >
                    {t('propertyManagement.heroCtaButton')}
                </Button>
            </Box>
        </Stack>
    );
};

export default PropertyManagement;
