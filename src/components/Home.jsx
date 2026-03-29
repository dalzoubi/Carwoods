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
import { Heading } from '../styles';
import heroKeysImg from '../assets/home/hero-keys.jpg';
import midHeroImg from '../assets/home/mid-hero-home.jpg';
import rentersPhoto from '../assets/home/renters-space.jpg';
import ownersPhoto from '../assets/home/owners-skyline.jpg';

const listSx = {
    m: 0,
    pl: 2.25,
    '& li': { mb: 0.75 },
};

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

/** Full-card link: hover/focus affordances, focus ring, reduced-motion safe */
const audienceTileLinkSx = (theme) => ({
    flex: { xs: '1 1 auto', md: '1 1 300px' },
    minWidth: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
    p: 0,
    overflow: 'visible',
    bgcolor: 'background.paper',
    border: 1,
    borderColor: 'divider',
    borderLeftWidth: 5,
    borderLeftColor: 'primary.main',
    borderRadius: 3,
    backgroundImage: 'none',
    boxShadow:
        theme.palette.mode === 'dark'
            ? `0 8px 24px ${alpha(theme.palette.common.black, 0.35)}`
            : `0 10px 28px ${alpha(theme.palette.primary.main, 0.08)}`,
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
    cursor: 'pointer',
    outline: 'none',
    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
    '&:visited': {
        color: 'inherit',
    },
    '&:focus-visible': {
        outline: `2px solid ${theme.palette.primary.main}`,
        outlineOffset: 3,
        boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.28)}, ${
            theme.palette.mode === 'dark'
                ? `0 8px 24px ${alpha(theme.palette.common.black, 0.35)}`
                : `0 10px 28px ${alpha(theme.palette.primary.main, 0.08)}`
        }`,
    },
    '@media (hover: hover)': {
        '&:hover': {
            borderColor: 'primary.light',
            boxShadow:
                theme.palette.mode === 'dark'
                    ? `0 12px 32px ${alpha(theme.palette.common.black, 0.45)}`
                    : `0 14px 36px ${alpha(theme.palette.primary.main, 0.14)}`,
        },
    },
    '@media (prefers-reduced-motion: reduce)': {
        transition: 'none',
    },
});

const HIGHLIGHTS = [
    { label: 'Houston market focus', detail: 'Local leasing rhythms, not generic playbooks' },
    { label: 'Operations you can feel', detail: 'Applications, rent, and maintenance in one flow' },
    { label: 'Communication that holds', detail: 'Fewer gaps, clearer next steps' },
];

const cardImageSx = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
};

/**
 * Full-bleed image band: `borderRadius` matches the tile + `overflow: hidden` so the photo follows
 * the card’s curves (no square corners cutting off the rounding); bottom stays curved into the copy.
 */
const audienceTileImageFrameSx = {
    position: 'relative',
    width: '100%',
    height: { xs: 200, sm: 220 },
    borderRadius: 3,
    overflow: 'hidden',
    bgcolor: 'action.hover',
};

const Home = () => {
    const theme = useTheme();
    const { pathname } = useLocation();
    const heroTint = alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.14 : 0.08);
    const heroBorder = alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.35 : 0.22);

    return (
        <Stack component="article" spacing={3.5}>
            <Helmet>
                <title>Carwoods — Houston rentals, managed right</title>
                <meta
                    name="description"
                    content="Houston rentals and property management: clear applications, consistent communication, on-time rent collection, proactive maintenance, and disciplined asset care."
                />
                <link rel="preload" as="image" href={heroKeysImg} />
            </Helmet>

            <Box
                sx={{
                    px: { xs: 2.25, sm: 3.5 },
                    py: { xs: 3, sm: 4 },
                    borderRadius: 2,
                    bgcolor: heroTint,
                    border: '1px solid',
                    borderColor: heroBorder,
                    backgroundImage: `linear-gradient(135deg, ${heroTint} 0%, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.06 : 0.02)} 100%)`,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
                    gap: { xs: 2.5, md: 3.5 },
                    alignItems: 'center',
                }}
            >
                <Box>
                    <Heading>Houston Rentals, Managed Right</Heading>
                    <Typography
                        variant="subtitle1"
                        component="p"
                        sx={{
                            mt: 0,
                            mb: 0,
                            maxWidth: 'md',
                            fontWeight: 600,
                            color: 'text.primary',
                            lineHeight: 1.45,
                        }}
                    >
                        Clear applications. Consistent communication. On-time rent collection, proactive
                        maintenance, and disciplined asset care.
                    </Typography>
                </Box>
                <Box
                    data-print-hide
                    sx={{
                        borderRadius: 2,
                        overflow: 'hidden',
                        minHeight: { xs: 200, sm: 220, md: 260 },
                        maxHeight: { xs: 280, md: 320 },
                        boxShadow:
                            theme.palette.mode === 'dark'
                                ? `0 12px 28px ${alpha(theme.palette.common.black, 0.4)}`
                                : `0 16px 40px ${alpha(theme.palette.common.black, 0.12)}`,
                    }}
                >
                    <Box
                        component="img"
                        src={heroKeysImg}
                        alt="Keys to a new home resting on a welcome mat"
                        width={800}
                        height={600}
                        sizes="(max-width: 900px) 100vw, 45vw"
                        sx={{ ...cardImageSx, minHeight: { xs: 200, md: 260 } }}
                    />
                </Box>
            </Box>

            <Box
                component="figure"
                data-print-hide
                sx={{
                    m: 0,
                    borderRadius: 2,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow:
                        theme.palette.mode === 'dark'
                            ? `0 6px 20px ${alpha(theme.palette.common.black, 0.35)}`
                            : `0 8px 24px ${alpha(theme.palette.common.black, 0.08)}`,
                }}
            >
                <Box
                    component="img"
                    src={midHeroImg}
                    alt="Modern home exterior with warm evening light"
                    width={1400}
                    height={560}
                    decoding="async"
                    sizes="100vw"
                    sx={{
                        width: '100%',
                        height: { xs: 168, sm: 200, md: 228 },
                        objectFit: 'cover',
                        display: 'block',
                    }}
                />
            </Box>

            <Stack
                component="section"
                aria-label="Company highlights"
                direction={{ xs: 'column', sm: 'row' }}
                spacing={0}
                sx={{
                    py: 2.25,
                    px: { xs: 0, sm: 0.5 },
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.04),
                    border: '1px solid',
                    borderColor: 'divider',
                }}
            >
                {HIGHLIGHTS.map((item, index) => (
                    <Box
                        key={item.label}
                        sx={{
                            flex: '1 1 0',
                            px: { xs: 2, sm: 2.5 },
                            py: { xs: 1.5, sm: 1 },
                            textAlign: { xs: 'left', sm: 'center' },
                            borderLeft:
                                index > 0
                                    ? { xs: 'none', sm: '1px solid' }
                                    : 'none',
                            borderTop:
                                index > 0 ? { xs: '1px solid', sm: 'none' } : 'none',
                            borderColor: 'divider',
                        }}
                    >
                        <Typography
                            variant="subtitle2"
                            component="h2"
                            sx={{
                                fontWeight: 800,
                                color: 'primary.main',
                                letterSpacing: 0.02,
                                textTransform: 'uppercase',
                                fontSize: '0.8rem',
                            }}
                        >
                            {item.label}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {item.detail}
                        </Typography>
                    </Box>
                ))}
            </Stack>

            <Stack
                component="section"
                aria-label="Choose renters or property owners"
                direction={{ xs: 'column', md: 'row' }}
                spacing={2.75}
                useFlexGap
                flexWrap="wrap"
                sx={{ width: '100%', minWidth: 0 }}
            >
                <Paper
                    component={Link}
                    to={withDarkPath(pathname, '/apply')}
                    elevation={0}
                    aria-labelledby="home-renters-title home-renters-cta"
                    sx={audienceTileLinkSx(theme)}
                >
                    <Box data-print-hide sx={audienceTileImageFrameSx}>
                        <Box
                            component="img"
                            src={rentersPhoto}
                            alt=""
                            width={1200}
                            height={750}
                            loading="lazy"
                            decoding="async"
                            sizes="(max-width: 900px) 100vw, 50vw"
                            sx={cardImageSx}
                            aria-hidden
                        />
                    </Box>
                    <Box sx={{ p: 2.75 }}>
                        <Typography
                            id="home-renters-title"
                            component="h2"
                            variant="h2"
                            sx={audienceTitleSx}
                        >
                            Renters
                        </Typography>
                        <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                            Looking for a lease in Houston? We keep the path honest: what you need to apply, what
                            to expect, and people who pick up the phone.
                        </Typography>
                        <Box component="ul" sx={{ ...listSx, color: 'text.secondary' }}>
                            <li>Streamlined application steps and required-documents guidance</li>
                            <li>Local listings mindset—we know this market&apos;s rhythms</li>
                            <li>Respect for your time: fewer surprises, clearer next steps</li>
                        </Box>
                        <Typography
                            id="home-renters-cta"
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
                            Start your application
                            <ChevronRight sx={{ fontSize: '1.35rem' }} aria-hidden />
                        </Typography>
                    </Box>
                </Paper>

                <Paper
                    component={Link}
                    to={withDarkPath(pathname, '/property-management')}
                    elevation={0}
                    aria-labelledby="home-owners-title home-owners-cta"
                    sx={audienceTileLinkSx(theme)}
                >
                    <Box data-print-hide sx={audienceTileImageFrameSx}>
                        <Box
                            component="img"
                            src={ownersPhoto}
                            alt=""
                            width={1200}
                            height={750}
                            loading="lazy"
                            decoding="async"
                            sizes="(max-width: 900px) 100vw, 50vw"
                            sx={cardImageSx}
                            aria-hidden
                        />
                    </Box>
                    <Box sx={{ p: 2.75 }}>
                        <Typography
                            id="home-owners-title"
                            component="h2"
                            variant="h2"
                            sx={audienceTitleSx}
                        >
                            Landlords & owners
                        </Typography>
                        <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                            Hand us the keys to the busywork. We market vacancies, screen tenants, coordinate
                            repairs, and report back so you can stay focused on the big picture.
                        </Typography>
                        <Box component="ul" sx={{ ...listSx, color: 'text.secondary' }}>
                            <li>Full-service property management tailored to your goals</li>
                            <li>Maintenance coordination and vendor relationships</li>
                            <li>Steady communication—you&apos;re never guessing what&apos;s happening</li>
                        </Box>
                        <Typography
                            id="home-owners-cta"
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
                            Explore property management
                            <ChevronRight sx={{ fontSize: '1.35rem' }} aria-hidden />
                        </Typography>
                    </Box>
                </Paper>
            </Stack>
        </Stack>
    );
};

export default Home;
