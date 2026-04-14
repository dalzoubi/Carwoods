import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { withDarkPath } from '../routePaths';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import rentersPhoto from '../assets/home/renters-space.jpg';
import ownersPhoto from '../assets/home/owners-skyline.jpg';
import managersPhoto from '../assets/home/managers-building.jpg';

const listSx = {
    m: 0,
    pl: 2.25,
    '& li': { mb: 0.75 },
};

const cardImageSx = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
};

/** Full-card link tile */
const audienceTileLinkSx = (theme, featured) => ({
    flex: featured ? '1 1 100%' : '1 1 280px',
    minWidth: 0,
    maxWidth: featured ? '100%' : '100%',
    boxSizing: 'border-box',
    p: 0,
    overflow: 'visible',
    bgcolor: featured
        ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.1 : 0.04)
        : 'background.paper',
    border: featured ? 2 : 1,
    borderColor: featured ? 'primary.main' : 'divider',
    borderLeftWidth: 5,
    borderLeftColor: 'primary.main',
    borderRadius: 3,
    backgroundImage: 'none',
    boxShadow:
        theme.palette.mode === 'dark'
            ? `0 8px 24px ${alpha(theme.palette.common.black, 0.35)}`
            : `0 10px 28px ${alpha(theme.palette.primary.main, featured ? 0.12 : 0.08)}`,
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
    cursor: 'pointer',
    outline: 'none',
    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
    '&:visited': { color: 'inherit' },
    '&:focus-visible': {
        outline: `2px solid ${theme.palette.primary.main}`,
        outlineOffset: 3,
        boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.28)}, ${
            theme.palette.mode === 'dark'
                ? `0 8px 24px ${alpha(theme.palette.common.black, 0.35)}`
                : `0 10px 28px ${alpha(theme.palette.primary.main, 0.08)}`
        }`,
    },
    '&:hover': {
        borderLeftColor: 'primary.light',
        boxShadow:
            theme.palette.mode === 'dark'
                ? `0 12px 32px ${alpha(theme.palette.common.black, 0.45)}`
                : `0 14px 36px ${alpha(theme.palette.primary.main, 0.14)}`,
    },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
});

const audienceTitleSx = {
    mt: 0,
    mb: 1,
    pb: 0.5,
    color: 'primary.main',
    borderBottom: 2,
    borderColor: 'primary.light',
    fontSize: { xs: '1.35rem', sm: '1.5rem' },
    fontWeight: 700,
};

function AudienceTile({ to, titleId, ctaId, image, imageAlt, imageSizes, imageHeight, title, body, bullets, cta, featured }) {
    const theme = useTheme();
    const imgFrameSx = {
        position: 'relative',
        width: '100%',
        height: imageHeight ?? { xs: 200, sm: 220 },
        borderRadius: '12px 12px 0 0',
        overflow: 'hidden',
        bgcolor: 'action.hover',
    };
    return (
        <Paper
            component={Link}
            to={to}
            elevation={0}
            aria-labelledby={`${titleId} ${ctaId}`}
            sx={audienceTileLinkSx(theme, featured)}
        >
            {image && (
                <Box data-print-hide sx={imgFrameSx}>
                    <Box
                        component="img"
                        src={image}
                        alt=""
                        aria-hidden
                        loading="lazy"
                        decoding="async"
                        sizes={imageSizes || '(max-width: 900px) 100vw, 33vw'}
                        sx={cardImageSx}
                    />
                </Box>
            )}
            <Box sx={{ p: featured ? { xs: 2.75, md: 3.5 } : 2.75 }}>
                {featured && (
                    <Typography
                        variant="overline"
                        component="p"
                        sx={{ fontWeight: 800, color: 'primary.main', letterSpacing: 0.08, mb: 0.5, fontSize: '0.7rem' }}
                    >
                        {/* eslint-disable-next-line react/prop-types */}
                    </Typography>
                )}
                <Typography id={titleId} component="h2" variant="h2" sx={audienceTitleSx}>
                    {title}
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                    {body}
                </Typography>
                <Box component="ul" sx={{ ...listSx, color: 'text.secondary' }}>
                    {bullets.map((b, i) => <li key={i}>{b}</li>)}
                </Box>
                <Typography
                    id={ctaId}
                    component="span"
                    variant="body1"
                    sx={{
                        mt: 2.5,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        fontWeight: 700,
                        color: 'primary.main',
                        textDecoration: 'underline',
                        textUnderlineOffset: '3px',
                    }}
                >
                    {cta}
                    <ChevronRight sx={{ fontSize: '1.35rem' }} aria-hidden />
                </Typography>
            </Box>
        </Paper>
    );
}

const Home = () => {
    const theme = useTheme();
    const { pathname } = useLocation();
    const { t } = useTranslation();

    const heroBg = alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.1 : 0.05);
    const heroBorder = alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.3 : 0.18);

    return (
        <Stack component="article" spacing={3.5}>
            <Helmet>
                <title>{t('home.title')}</title>
                <meta name="description" content={t('home.metaDescription')} />
            </Helmet>

            {/* Page header */}
            <Box
                sx={{
                    textAlign: 'center',
                    pt: { xs: 2, sm: 3 },
                    pb: { xs: 1, sm: 1.5 },
                    px: { xs: 2, sm: 3 },
                    borderRadius: 2,
                    bgcolor: heroBg,
                    border: '1px solid',
                    borderColor: heroBorder,
                }}
            >
                <Typography
                    variant="h1"
                    component="h1"
                    sx={{
                        fontSize: { xs: '1.65rem', sm: '2rem', md: '2.4rem' },
                        fontWeight: 800,
                        lineHeight: 1.2,
                        color: 'text.primary',
                        mb: 1.25,
                    }}
                >
                    {t('home.heroHeadingNew', 'Houston Property Management')}
                </Typography>
                <Typography
                    variant="subtitle1"
                    component="p"
                    sx={{
                        color: 'text.secondary',
                        maxWidth: 560,
                        mx: 'auto',
                        lineHeight: 1.5,
                        fontSize: { xs: '0.95rem', sm: '1rem' },
                    }}
                >
                    {t('home.heroSubtitleNew', 'Find a Houston rental. Hire us to manage your property. Or use our portal to self-manage your own.')}
                </Typography>
            </Box>

            {/* Audience picker — featured SaaS tile, then renters + owners row */}
            <Stack
                component="section"
                aria-label={t('home.audienceLabel')}
                spacing={2.75}
                useFlexGap
                sx={{ width: '100%', minWidth: 0 }}
            >
                {/* Featured: Self-Managing Landlords */}
                <AudienceTile
                    to={withDarkPath(pathname, '/pricing')}
                    titleId="home-self-managers-title"
                    ctaId="home-self-managers-cta"
                    image={managersPhoto}
                    imageSizes="(max-width: 900px) 100vw, 80vw"
                    imageHeight={{ xs: 220, sm: 300, md: 360 }}
                    title={t('home.selfManagersTitle')}
                    body={t('home.selfManagersBody')}
                    bullets={[
                        t('home.selfManagersBullet1'),
                        t('home.selfManagersBullet2'),
                        t('home.selfManagersBullet3'),
                    ]}
                    cta={t('home.selfManagersCta')}
                    featured
                />

                {/* Supporting tiles: Renters + Property Owners */}
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={2.75}
                    useFlexGap
                    flexWrap="wrap"
                    sx={{ width: '100%', minWidth: 0 }}
                >
                    <AudienceTile
                        to={withDarkPath(pathname, '/apply')}
                        titleId="home-renters-title"
                        ctaId="home-renters-cta"
                        image={rentersPhoto}
                        imageSizes="(max-width: 900px) 100vw, 50vw"
                        title={t('home.rentersTitle')}
                        body={t('home.rentersBody')}
                        bullets={[
                            t('home.rentersBullet1'),
                            t('home.rentersBullet2'),
                            t('home.rentersBullet3'),
                        ]}
                        cta={t('home.rentersCta')}
                    />

                    <AudienceTile
                        to={withDarkPath(pathname, '/property-management')}
                        titleId="home-owners-title"
                        ctaId="home-owners-cta"
                        image={ownersPhoto}
                        imageSizes="(max-width: 900px) 100vw, 50vw"
                        title={t('home.ownersTitle')}
                        body={t('home.ownersBody')}
                        bullets={[
                            t('home.ownersBullet1'),
                            t('home.ownersBullet2'),
                            t('home.ownersBullet3'),
                        ]}
                        cta={t('home.ownersCta')}
                    />
                </Stack>
            </Stack>
        </Stack>
    );
};

export default Home;
