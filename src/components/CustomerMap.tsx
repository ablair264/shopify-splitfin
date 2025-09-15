import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseService';
import { Menu } from 'lucide-react';
import { withLoader } from '../hoc/withLoader';
import './CustomerMap.css';

const GOOGLE_MAPS_API_KEY = 'AIzaSyCtvRdpXyzAg2YTTf398JHSxGA1dmD4Doc';
const DM_BRANDS_ID = '87dcc6db-2e24-46fb-9a12-7886f690a326';

// UK Regions - keeping just centers for zoom functionality
const UK_REGIONS = {
  'Scotland': {
    center: { lat: 56.4907, lng: -4.2026 },
    color: '#1f77b4'
  },
  'North East': {
    center: { lat: 54.9783, lng: -1.6178 },
    color: '#ff7f0e'
  },
  'North West': {
    center: { lat: 53.7632, lng: -2.7044 },
    color: '#2ca02c'
  },
  'Wales': {
    center: { lat: 52.1307, lng: -3.7837 },
    color: '#d62728'
  },
  'Midlands': {
    center: { lat: 52.4862, lng: -1.8904 },
    color: '#9467bd'
  },
  'London': {
    center: { lat: 51.5074, lng: -0.1278 },
    color: '#8c564b'
  },
  'South East': {
    center: { lat: 51.2787, lng: 0.5217 },
    color: '#e377c2'
  },
  'South West': {
    center: { lat: 50.7772, lng: -3.9997 },
    color: '#7f7f7f'
  },
  'Ireland': {
    center: { lat: 53.4129, lng: -8.2439 },
    color: '#ff6b6b'
  }
};

interface Customer {
  id: string;
  fb_customer_id: string;
  customer_id: string;
  customer_name: string;
  display_name: string;
  email?: string;
  postcode?: string;
  billing_postcode?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  location_region?: string;
  billing_county?: string;
  total_spent?: number;
  order_count?: number;
  last_order_date?: string;
}

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: 54.5,
  lng: -4
};

const options = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
  styles: [
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#1a2332" }]
    },
    {
      featureType: "landscape",
      elementType: "geometry",
      stylers: [{ color: "#2c3e50" }]
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#34495e" }]
    },
    {
      featureType: "poi",
      elementType: "geometry",
      stylers: [{ color: "#34495e" }]
    },
    {
      featureType: "transit",
      elementType: "geometry",
      stylers: [{ color: "#34495e" }]
    },
    {
      elementType: "labels.text.stroke",
      stylers: [{ color: "#1a1f2a" }]
    },
    {
      elementType: "labels.text.fill",
      stylers: [{ color: "#95a5a6" }]
    }
  ]
};

function CustomerMap() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [map, setMap] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [markers, setMarkers] = useState<any[]>([]);
  const [clusterer, setClusterer] = useState<any>(null);
  const [infoWindow, setInfoWindow] = useState<any>(null);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Load Google Maps API
  useEffect(() => {
    const loadGoogleMaps = async () => {
      try {
        if (window.google && window.google.maps) {
          console.log('Google Maps API already loaded');
          requestAnimationFrame(() => {
            setTimeout(() => initializeMap(), 10);
          });
          return;
        }

        // Check if script already exists
        const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
        if (existingScript) {
          console.log('Google Maps script already exists, waiting for load');
          // Wait for existing script to load
          existingScript.addEventListener('load', () => {
            console.log('Existing Google Maps script loaded');
            requestAnimationFrame(() => {
              setTimeout(() => initializeMap(), 10);
            });
          });
          return;
        }

        console.log('Loading Google Maps API...');
        // Create promise-based loading
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry`;
          script.async = true;
          script.defer = true;
          
          script.onload = () => {
            console.log('Google Maps API loaded successfully');
            resolve();
          };
          script.onerror = () => {
            console.error('Failed to load Google Maps API');
            reject(new Error('Failed to load Google Maps API'));
          };
          
          document.head.appendChild(script);
        });

        // Initialize map after API is loaded - use requestAnimationFrame to ensure DOM is ready
        console.log('Initializing map after API load');
        requestAnimationFrame(() => {
          setTimeout(() => initializeMap(), 10);
        });
      } catch (error) {
        console.error('Error loading Google Maps:', error);
        setLoading(false);
      }
    };

    loadGoogleMaps();
  }, []);

  // Fetch customers data - only once on mount
  useEffect(() => {
    fetchCustomers();
  }, []);

  // Try to initialize map when component mounts and DOM is ready
  useEffect(() => {
    if (window.google && window.google.maps && mapRef.current && !mapReady) {
      console.log('DOM ready, trying to initialize map');
      initializeMap();
    }
  }, [dataReady, mapReady]); // Trigger when data is ready too

  // Initialize markers only when both map and data are ready AND a region is selected
  useEffect(() => {
    if (mapReady && dataReady && customers.length > 0 && selectedRegion) {
      console.log('Map, data, and region selected - initializing markers for region:', selectedRegion);
      console.log('Total customers available:', customers.length);
      
      // Debug: Show region distribution in customers array
      const regionDebug: Record<string, number> = {};
      customers.forEach(customer => {
        const region = customer.location_region || 'NO_REGION';
        regionDebug[region] = (regionDebug[region] || 0) + 1;
      });
      console.log('Available regions in customers array:', regionDebug);
      
      const regionCustomers = customers.filter(customer => customer.location_region === selectedRegion);
      console.log(`Found ${regionCustomers.length} customers for region "${selectedRegion}"`);
      
      // Debug: Show some sample customers for the selected region
      if (regionCustomers.length > 0) {
        console.log('Sample customers:', regionCustomers.slice(0, 3).map(c => ({
          name: c.display_name,
          region: c.location_region,
          county: c.billing_county,
          postcode: c.billing_postcode
        })));
      } else {
        console.log('No customers found for region. Checking for similar region names...');
        const regionSet = new Set(customers.map(c => c.location_region).filter(Boolean));
        const allRegions = Array.from(regionSet);
        console.log('All unique regions in data:', allRegions);
      }
      
      initializeMarkers(regionCustomers);
    } else if (mapReady && !selectedRegion) {
      // Clear all markers when no region is selected
      console.log('No region selected - clearing all markers');
      markers.forEach(marker => marker.setMap(null));
      setMarkers([]);
    }
  }, [mapReady, dataReady, customers, map, selectedRegion]);

  const fetchCustomers = async () => {
    try {
      console.log('Fetching customers...');
      
      // Get current user's company context
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user found');
        setLoading(false);
        return;
      }

      // Get user's company information
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('company_id, role, permissions')
        .eq('auth_user_id', user.id)
        .single();

      if (userError) {
        console.error('Error fetching user data:', userError);
        setLoading(false);
        return;
      }

      if (!userData?.company_id) {
        console.error('No company found for user');
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('customers')
        .select(`
          id, 
          fb_customer_id, 
          display_name, 
          email, 
          phone, 
          coordinates,
          billing_postcode,
          billing_county,
          total_spent,
          order_count,
          last_order_date,
          linked_company
        `)
        .not('coordinates', 'is', null)
        .eq('is_active', true)
        .eq('linked_company', userData.company_id);

      if (error) {
        console.error('Error fetching customers:', error);
        throw error;
      }

      console.log('Fetched', data?.length || 0, 'customers with coordinates');

      // Log some sample data for debugging
      if (data && data.length > 0) {
        const sampleCustomer = data[0];
        console.log('Sample customer fields:', Object.keys(sampleCustomer));
        console.log('Sample customer data:', {
          billing_county: sampleCustomer.billing_county,
          billing_postcode: sampleCustomer.billing_postcode,
          coordinates: sampleCustomer.coordinates
        });
      }
      
      const sampleCounties = data?.slice(0, 10).map(c => c.billing_county).filter(Boolean);
      console.log('Sample billing counties:', sampleCounties);
      
      const customersData = (data || []).map(customer => {
        const coords = parseCoordinates(customer.coordinates);
        const region = mapCountyToRegion(customer.billing_county) || mapPostcodeToRegion(customer.billing_postcode);
        
        return {
          id: customer.id,
          fb_customer_id: customer.fb_customer_id,
          customer_id: customer.fb_customer_id,
          customer_name: customer.display_name,
          display_name: customer.display_name,
          email: customer.email || '',
          postcode: customer.billing_postcode || '',
          billing_postcode: customer.billing_postcode,
          coordinates: coords ? {
            latitude: coords.lat,
            longitude: coords.lng
          } : undefined,
          location_region: region,
          billing_county: customer.billing_county,
          total_spent: customer.total_spent || 0,
          order_count: customer.order_count || 0,
          last_order_date: customer.last_order_date
        };
      }).filter(customer => customer.coordinates);
      
      // Log region distribution
      const regionCounts: Record<string, number> = {};
      customersData.forEach(customer => {
        const region = customer.location_region || 'NO_REGION';
        regionCounts[region] = (regionCounts[region] || 0) + 1;
      });
      console.log('Region distribution:', regionCounts);
      
      // Also log customers without regions
      const customersWithoutRegion = customersData.filter(c => !c.location_region);
      console.log(`${customersWithoutRegion.length} customers without region assignment`);
      if (customersWithoutRegion.length > 0) {
        console.log('Sample customers without region:', customersWithoutRegion.slice(0, 5).map(c => ({
          name: c.display_name,
          county: c.billing_county,
          postcode: c.billing_postcode
        })));
      }
      
      console.log('Processed', customersData.length, 'customers with valid coordinates');
      setCustomers(customersData);
      setDataReady(true);
      
    } catch (error) {
      console.error('Error fetching customers:', error);
      setCustomers([]);
      setDataReady(true);
    } finally {
      setLoading(false);
    }
  };

  const parseCoordinates = (coordString: string | null) => {
    if (!coordString) return null;
    
    try {
      // Handle format like "(longitude,latitude)" or "longitude,latitude"
      const cleaned = coordString.replace(/[()]/g, '');
      const [lng, lat] = cleaned.split(',').map(coord => parseFloat(coord.trim()));
      
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    } catch (error) {
      console.warn('Invalid coordinates:', coordString);
    }
    return null;
  };

  const mapCountyToRegion = (county: string | null): string => {
    if (!county) return '';
    
    const countyLower = county.toLowerCase().trim();
    
    // Scotland
    if (countyLower.includes('scotland') || countyLower.includes('edinburgh') || countyLower.includes('glasgow') ||
        countyLower.includes('aberdeenshire') || countyLower.includes('highland') || countyLower.includes('fife') ||
        countyLower.includes('stirling') || countyLower.includes('perth') || countyLower.includes('dundee') ||
        countyLower.includes('borders') || countyLower.includes('dumfries') || countyLower.includes('ayrshire')) {
      return 'Scotland';
    }
    
    // North East
    if (countyLower.includes('northumberland') || countyLower.includes('durham') || countyLower.includes('tyne') ||
        countyLower.includes('sunderland') || countyLower.includes('newcastle') || countyLower.includes('gateshead') ||
        countyLower.includes('middlesbrough') || countyLower.includes('teesside') || countyLower.includes('north east') ||
        countyLower.includes('hartlepool') || countyLower.includes('darlington') || countyLower.includes('stockton') ||
        countyLower.includes('redcar') || countyLower.includes('cleveland') || countyLower.includes('tees valley')) {
      return 'North East';
    }
    
    // North West
    if (countyLower.includes('manchester') || countyLower.includes('liverpool') || countyLower.includes('lancashire') ||
        countyLower.includes('cumbria') || countyLower.includes('preston') || countyLower.includes('blackpool') ||
        countyLower.includes('bolton') || countyLower.includes('oldham') || countyLower.includes('stockport') ||
        countyLower.includes('wigan') || countyLower.includes('salford') || countyLower.includes('rochdale') ||
        countyLower.includes('warrington') || countyLower.includes('chester') || countyLower.includes('crewe') ||
        countyLower.includes('north west') || countyLower.includes('greater manchester') || countyLower.includes('merseyside') ||
        countyLower.includes('cheshire') || countyLower.includes('carlisle') || countyLower.includes('kendal') ||
        countyLower.includes('burnley') || countyLower.includes('bury') || countyLower.includes('tameside') ||
        countyLower.includes('trafford') || countyLower.includes('st helens') || countyLower.includes('wirral') ||
        countyLower.includes('sefton') || countyLower.includes('knowsley')) {
      return 'North West';
    }
    
    // Wales
    if (countyLower.includes('wales') || countyLower.includes('cardiff') || countyLower.includes('swansea') ||
        countyLower.includes('newport') || countyLower.includes('wrexham') || countyLower.includes('bangor') ||
        countyLower.includes('aberystwyth') || countyLower.includes('carmarthen') || countyLower.includes('conwy') ||
        countyLower.includes('flintshire') || countyLower.includes('gwynedd') || countyLower.includes('powys') ||
        countyLower.includes('ceredigion') || countyLower.includes('pembrokeshire') || countyLower.includes('monmouthshire')) {
      return 'Wales';
    }
    
    // Midlands  
    if (countyLower.includes('birmingham') || countyLower.includes('nottingham') || countyLower.includes('leicester') ||
        countyLower.includes('derby') || countyLower.includes('coventry') || countyLower.includes('wolverhampton') ||
        countyLower.includes('stoke') || countyLower.includes('west midlands') || countyLower.includes('east midlands') ||
        countyLower.includes('warwickshire') || countyLower.includes('staffordshire') || countyLower.includes('shropshire') ||
        countyLower.includes('worcestershire') || countyLower.includes('herefordshire') || countyLower.includes('northamptonshire') ||
        countyLower.includes('lincolnshire') || countyLower.includes('rutland') || countyLower.includes('derbyshire') ||
        countyLower.includes('midlands') || countyLower.includes('leicestershire') || countyLower.includes('nottinghamshire') ||
        countyLower.includes('dudley') || countyLower.includes('walsall') || countyLower.includes('solihull') ||
        countyLower.includes('sandwell') || countyLower.includes('telford') || countyLower.includes('shrewsbury') ||
        countyLower.includes('worcester') || countyLower.includes('hereford') || countyLower.includes('northampton') ||
        countyLower.includes('lincoln') || countyLower.includes('mansfield') || countyLower.includes('chesterfield') ||
        countyLower.includes('burton') || countyLower.includes('stafford') || countyLower.includes('cannock') ||
        countyLower.includes('tamworth') || countyLower.includes('nuneaton') || countyLower.includes('rugby')) {
      return 'Midlands';
    }
    
    // London
    if (countyLower.includes('london') || countyLower.includes('greater london') ||
        countyLower.includes('westminster') || countyLower.includes('camden') || countyLower.includes('islington') ||
        countyLower.includes('hackney') || countyLower.includes('tower hamlets') || countyLower.includes('greenwich') ||
        countyLower.includes('lewisham') || countyLower.includes('southwark') || countyLower.includes('lambeth') ||
        countyLower.includes('wandsworth') || countyLower.includes('hammersmith') || countyLower.includes('kensington') ||
        countyLower.includes('chelsea') || countyLower.includes('ealing') || countyLower.includes('hounslow') ||
        countyLower.includes('richmond') || countyLower.includes('kingston') || countyLower.includes('merton') ||
        countyLower.includes('sutton') || countyLower.includes('croydon') || countyLower.includes('bromley') ||
        countyLower.includes('bexley') || countyLower.includes('havering') || countyLower.includes('barking') ||
        countyLower.includes('redbridge') || countyLower.includes('waltham') || countyLower.includes('haringey') ||
        countyLower.includes('enfield') || countyLower.includes('barnet') || countyLower.includes('harrow') ||
        countyLower.includes('brent') || countyLower.includes('hillingdon')) {
      return 'London';
    }
    
    // South West
    if (countyLower.includes('devon') || countyLower.includes('cornwall') || countyLower.includes('somerset') ||
        countyLower.includes('dorset') || countyLower.includes('bristol') || countyLower.includes('bath') ||
        countyLower.includes('gloucestershire') || countyLower.includes('wiltshire') || countyLower.includes('plymouth') ||
        countyLower.includes('exeter') || countyLower.includes('torbay') || countyLower.includes('bournemouth') ||
        countyLower.includes('poole') || countyLower.includes('swindon') || countyLower.includes('south gloucestershire')) {
      return 'South West';
    }
    
    // Ireland
    if (countyLower.includes('ireland') || countyLower.includes('dublin') || countyLower.includes('cork') ||
        countyLower.includes('galway') || countyLower.includes('waterford') || countyLower.includes('limerick') ||
        countyLower.includes('belfast') || countyLower.includes('northern ireland') || countyLower.includes('antrim') ||
        countyLower.includes('armagh') || countyLower.includes('down') || countyLower.includes('fermanagh') ||
        countyLower.includes('londonderry') || countyLower.includes('tyrone') || countyLower.includes('kerry') ||
        countyLower.includes('mayo') || countyLower.includes('donegal') || countyLower.includes('wicklow') ||
        countyLower.includes('meath') || countyLower.includes('kildare') || countyLower.includes('tipperary') ||
        countyLower.includes('clare') || countyLower.includes('kilkenny') || countyLower.includes('laois') ||
        countyLower.includes('offaly') || countyLower.includes('westmeath') || countyLower.includes('longford') ||
        countyLower.includes('roscommon') || countyLower.includes('sligo') || countyLower.includes('leitrim') ||
        countyLower.includes('cavan') || countyLower.includes('monaghan') || countyLower.includes('louth') ||
        countyLower.includes('carlow') || countyLower.includes('wexford')) {
      return 'Ireland';
    }
    
    // South East - add the unmapped counties we're seeing
    if (countyLower.includes('kent') || countyLower.includes('essex') || countyLower.includes('surrey') || 
        countyLower.includes('sussex') || countyLower.includes('berkshire') || countyLower.includes('hampshire') ||
        countyLower.includes('oxfordshire') || countyLower.includes('buckinghamshire') || countyLower.includes('hertfordshire') ||
        countyLower.includes('bedfordshire') || countyLower.includes('cambridgeshire') || countyLower.includes('norfolk') ||
        countyLower.includes('suffolk') || countyLower.includes('east of england')) {
      return 'South East';
    }
    
    // Handle special cases
    if (countyLower.includes('isle of man')) {
      return 'Ireland'; // Isle of Man is closer to Ireland region
    }
    
    if (countyLower.includes('avon')) {
      return 'South West'; // Avon is around Bristol area
    }
    
    if (countyLower.includes('england') || countyLower === '') {
      // Generic "England" or empty - don't assign to any region for now
      return '';
    }
    
    // Log unmapped counties for debugging
    console.log('Unmapped county defaulting to South East:', county);
    return 'South East';
  };

  const mapPostcodeToRegion = (postcode: string | null): string => {
    if (!postcode) return '';
    
    const postcodeUpper = postcode.toUpperCase().trim();
    const area = postcodeUpper.substring(0, 2);
    
    // Scotland
    if (['AB', 'DD', 'DG', 'EH', 'FK', 'G', 'HS', 'IV', 'KA', 'KW', 'KY', 'ML', 'PA', 'PH', 'TD', 'ZE'].includes(area) ||
        area === 'DG' || area === 'KA' || area === 'ML') {
      return 'Scotland';
    }
    
    // North East
    if (['DH', 'DL', 'NE', 'SR', 'TS'].includes(area) || area === 'DH' || area === 'DL') {
      return 'North East';
    }
    
    // North West
    if (['BB', 'BL', 'CA', 'CH', 'CW', 'FY', 'L', 'LA', 'M', 'OL', 'PR', 'SK', 'WA', 'WN'].includes(area)) {
      return 'North West';
    }
    
    // Wales
    if (['CF', 'LD', 'LL', 'NP', 'SA', 'SY'].includes(area)) {
      return 'Wales';
    }
    
    // Midlands
    if (['B', 'CV', 'DE', 'HR', 'LE', 'LN', 'NG', 'NN', 'PE', 'S', 'ST', 'SY', 'TF', 'WR', 'WS', 'WV', 'DN'].includes(area)) {
      return 'Midlands';
    }
    
    // London
    if (['BR', 'CR', 'DA', 'E', 'EC', 'EN', 'HA', 'IG', 'KT', 'N', 'NW', 'RM', 'SE', 'SM', 'SW', 'TW', 'UB', 'W', 'WC', 'WD'].includes(area)) {
      return 'London';
    }
    
    // South West
    if (['BA', 'BS', 'DT', 'EX', 'GL', 'PL', 'SN', 'SP', 'TA', 'TQ', 'TR'].includes(area)) {
      return 'South West';
    }
    
    // South East
    if (['AL', 'BN', 'CB', 'CM', 'CO', 'CT', 'GU', 'HP', 'IP', 'LU', 'ME', 'MK', 'NR', 'OX', 'PO', 'RG', 'RH', 'SG', 'SL', 'SO', 'SS', 'TN'].includes(area)) {
      return 'South East';
    }
    
    // Ireland (including Northern Ireland)
    if (['BT'].includes(area)) {
      return 'Ireland';
    }
    
    return '';
  };

  const initializeMap = () => {
    if (!mapRef.current || !window.google || !window.google.maps) {
      console.log('Map initialization failed - missing requirements:', {
        mapRef: !!mapRef.current,
        google: !!window.google,
        googleMaps: !!(window.google && window.google.maps)
      });
      return;
    }

    try {
      console.log('Initializing Google Map...');
      const mapInstance = new window.google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: 6,
        ...options
      });

      const infoWindowInstance = new window.google.maps.InfoWindow();

      setMap(mapInstance);
      setInfoWindow(infoWindowInstance);
      setMapReady(true);

      console.log('Map initialized successfully');
    } catch (error) {
      console.error('Error initializing map:', error);
      setLoading(false);
    }
  };

  const initializeMarkers = (customersData: Customer[]) => {
    if (!map || !window.google || !window.google.maps) {
      console.log('Cannot initialize markers - map or Google Maps API not ready');
      return;
    }

    console.log('Initializing markers for', customersData.length, 'customers');

    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));
    if (clusterer) {
      clusterer.clearMarkers();
    }

    const newMarkers: any[] = [];

    customersData.forEach(customer => {
      if (customer.coordinates) {
        const marker = new window.google.maps.Marker({
          position: {
            lat: customer.coordinates.latitude,
            lng: customer.coordinates.longitude
          },
          map: map, // Show on map immediately
          title: customer.customer_name,
          icon: getMarkerIcon(customer)
        });

        marker.addListener('click', () => {
          setSelectedCustomer(customer);
          showInfoWindow(customer, marker);
        });

        newMarkers.push(marker);
      }
    });

    console.log('Created', newMarkers.length, 'markers for selected region');
    setMarkers(newMarkers);
  };

  const getMarkerIcon = (customer: Customer): any => {
    const scale = customer.total_spent 
      ? Math.min(Math.max(customer.total_spent / 1000, 10), 20) 
      : 10;
    
    const color = customer.total_spent && customer.total_spent > 10000 ? '#ff4444' : 
                  customer.total_spent && customer.total_spent > 5000 ? '#ff8800' : 
                  '#4CAF50';
    
    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: scale,
      fillColor: color,
      fillOpacity: 0.8,
      strokeColor: 'white',
      strokeWeight: 2
    };
  };

  const showInfoWindow = (customer: Customer, marker: any) => {
    if (!infoWindow) return;

    const content = `
      <div class="customer-popup-enhanced">
        <div class="popup-header">
          <h4>${customer.customer_name}</h4>
          <p class="customer-email">${customer.email}</p>
        </div>
        
        <div class="popup-info">
          <div class="info-item">
            <span class="info-label">Location:</span>
            <span class="info-value">${customer.postcode}</span>
          </div>
          <div class="popup-stats">
            <div class="stat-item">
              <span class="stat-label">Orders</span>
              <span class="stat-value">${customer.order_count || 0}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Last Order</span>
              <span class="stat-value">
                ${customer.last_order_date 
                  ? new Date(customer.last_order_date).toLocaleDateString('en-GB', { 
                      day: '2-digit', 
                      month: 'short', 
                      year: 'numeric' 
                    })
                  : 'No orders'}
              </span>
            </div>
          </div>
        </div>
        
        <div class="popup-actions">
          <button 
            class="popup-btn btn-view"
            onclick="window.viewCustomer('${customer.id}')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
            View Customer
          </button>
          <button 
            class="popup-btn btn-directions"
            onclick="window.getDirections('${customer.coordinates!.latitude}', '${customer.coordinates!.longitude}')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.71 11.29l-9-9c-.39-.39-1.02-.39-1.41 0l-9 9c-.39.39-.39 1.02 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9c.39-.38.39-1.01 0-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z"/>
            </svg>
            Get Directions
          </button>
        </div>
      </div>
    `;

    infoWindow.setContent(content);
    infoWindow.open(map, marker);

    // Set up global functions for popup buttons
    (window as any).viewCustomer = (customerId: string) => {
      navigate(`/customers/${customerId}`);
    };

    (window as any).getDirections = (lat: number, lng: number) => {
      const destination = `${lat},${lng}`;
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
    };
  };

  const filteredCustomers = useMemo(() => {
    if (!selectedRegion) return customers;
    return customers.filter(customer => customer.location_region === selectedRegion);
  }, [customers, selectedRegion]);

  const regionStats = useMemo(() => {
    const stats: Record<string, { count: number; revenue: number }> = {};
    
    Object.keys(UK_REGIONS).forEach(region => {
      stats[region] = { count: 0, revenue: 0 };
    });
    
    customers.forEach(customer => {
      const region = customer.location_region;
      if (region && stats[region]) {
        stats[region].count++;
        stats[region].revenue += customer.total_spent || 0;
      }
    });
    
    return stats;
  }, [customers]);

  // Single handleRegionClick function with mobile logic
  const handleRegionClick = (region: string) => {
    setSelectedRegion(region === selectedRegion ? null : region);
    
    // Close sidebar on mobile after selection
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
    
    if (map && mapReady && region !== selectedRegion && UK_REGIONS[region as keyof typeof UK_REGIONS]) {
      const regionData = UK_REGIONS[region as keyof typeof UK_REGIONS];
      map.panTo(regionData.center);
      map.setZoom(7);
      
      // Update markers for selected region
      const regionCustomers = customers.filter(customer => customer.location_region === region);
      initializeMarkers(regionCustomers);
    } else if (map && mapReady) {
      map.panTo(defaultCenter);
      map.setZoom(6);
      
      // Show all markers
      initializeMarkers(customers);
    }
  };

  return (
    <div className="customer-map-container">
      {/* Mobile menu toggle */}
      <button 
        className="mobile-menu-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        <Menu size={24} />
      </button>

      {/* Sidebar overlay for mobile */}
      <div 
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className={`map-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <h2>UK Regions</h2>
        <div className="region-list">
          {Object.entries(UK_REGIONS).map(([region, config]) => (
            <div
              key={region}
              className={`region-item ${selectedRegion === region ? 'active' : ''}`}
              onClick={() => handleRegionClick(region)}
              style={{ borderLeftColor: config.color }}
            >
              <h3>{region}</h3>
              <div className="region-stats">
                <span>{regionStats[region]?.count || 0} customers</span>
                <span>£{(regionStats[region]?.revenue || 0).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="map-content">
        <div ref={mapRef} style={mapContainerStyle} />
      </div>
    </div>
  );
}

export default withLoader(CustomerMap);